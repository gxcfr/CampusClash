import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export interface UseHandDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  onDetect?: (num: number | null) => void;
  enabled?: boolean;
}

export function useHandDetection({ videoRef, canvasRef, onDetect, enabled = true }: UseHandDetectionOptions) {
  const [isModelLoading, setIsModelLoading] = useState(enabled);
  const [isModelReady, setIsModelReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDelegate, setActiveDelegate] = useState<'GPU' | 'CPU' | null>(null);

  const [detectedNumber, setDetectedNumber] = useState<number | null>(null);
  const [fingerStates, setFingerStates] = useState<FingerStates>({
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  });
  const [handPresent, setHandPresent] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [gestureLabel, setGestureLabel] = useState<string>('No Hand Detected');

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<number[]>([]);
  const isSamplingRef = useRef(false);
  const lastTimeMsRef = useRef<number>(0);

  // Initialize MediaPipe Tasks-Vision with dual GPU -> CPU fallback for mobile devices
  useEffect(() => {
    if (!enabled) {
      setIsModelLoading(false);
      return;
    }
    let isCancelled = false;

    async function initMediaPipe() {
      try {
        setIsModelLoading(true);
        setLoadError(null);

        // Fetch official WASM binaries from official jsdelivr CDN
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        if (isCancelled) return;

        const modelUrl =
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

        let landmarker: HandLandmarker | null = null;
        let chosenDelegate: 'GPU' | 'CPU' = 'GPU';

        const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
        const preferredDelegate: 'CPU' | 'GPU' = isAndroid ? 'CPU' : 'GPU';
        const fallbackDelegate: 'CPU' | 'GPU' = isAndroid ? 'GPU' : 'CPU';

        // 1. Attempt preferred delegate (CPU on Android S25 for stability, GPU on iPhone/Desktop)
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: preferredDelegate,
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.25,
            minHandPresenceConfidence: 0.25,
            minTrackingConfidence: 0.25,
          });
          chosenDelegate = preferredDelegate;
        } catch (firstErr) {
          console.warn(`Delegate ${preferredDelegate} failed, falling back to ${fallbackDelegate}:`, firstErr);
          // 2. Fallback to alternative delegate
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: fallbackDelegate,
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.25,
            minHandPresenceConfidence: 0.25,
            minTrackingConfidence: 0.25,
          });
          chosenDelegate = fallbackDelegate;
        }

        if (isCancelled) {
          landmarker?.close();
          return;
        }

        handLandmarkerRef.current = landmarker;
        setActiveDelegate(chosenDelegate);
        setIsModelReady(true);
        setIsModelLoading(false);
      } catch (err: any) {
        console.error('Failed to load MediaPipe HandLandmarker:', err);
        if (!isCancelled) {
          setLoadError(err?.message || 'Failed to initialize edge computer vision on this device.');
          setIsModelLoading(false);
        }
      }
    }

    initMediaPipe();

    return () => {
      isCancelled = true;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, []);

  /**
   * Rotation-Invariant Euclidean Distance Finger Counting
   * Works on mobile in portrait, landscape, or at any tilted angle!
   *
   * Landmarks indices:
   * 0: Wrist
   * 1-4: Thumb (CMC=1, MCP=2, IP=3, TIP=4)
   * 5-8: Index (MCP=5, PIP=6, DIP=7, TIP=8)
   * 9-12: Middle (MCP=9, PIP=10, DIP=11, TIP=12)
   * 13-16: Ring (MCP=13, PIP=14, DIP=15, TIP=16)
   * 17-20: Pinky (MCP=17, PIP=18, DIP=19, TIP=20)
   */
  const evaluateFingers = useCallback(
    (landmarks: NormalizedLandmark[], handedness: string = 'Right') => {
      const wrist = landmarks[0];

      // Helper for 2D euclidean distance
      const dist = (p1: NormalizedLandmark, p2: NormalizedLandmark) =>
        Math.hypot(p1.x - p2.x, p1.y - p2.y);

      // 1. Four main fingers: Check if tip is extended away from wrist and MCP
      // A curled finger has its tip much closer to wrist/MCP than its PIP joint!
      const isIndexExtended =
        dist(wrist, landmarks[8]) > dist(wrist, landmarks[6]) * 1.15 &&
        dist(landmarks[5], landmarks[8]) > dist(landmarks[5], landmarks[6]);

      const isMiddleExtended =
        dist(wrist, landmarks[12]) > dist(wrist, landmarks[10]) * 1.15 &&
        dist(landmarks[9], landmarks[12]) > dist(landmarks[9], landmarks[10]);

      const isRingExtended =
        dist(wrist, landmarks[16]) > dist(wrist, landmarks[14]) * 1.15 &&
        dist(landmarks[13], landmarks[16]) > dist(landmarks[13], landmarks[14]);

      const isPinkyExtended =
        dist(wrist, landmarks[20]) > dist(wrist, landmarks[18]) * 1.15 &&
        dist(landmarks[17], landmarks[20]) > dist(landmarks[17], landmarks[18]);

      // 2. Thumb extension check
      // Checks distance from pinky MCP (knuckle base) and palm center
      const thumbTip = landmarks[4];
      const thumbIp = landmarks[3];
      const thumbMcp = landmarks[2];
      const pinkyMcp = landmarks[17];
      const indexMcp = landmarks[5];

      const thumbToPinkyDist = dist(thumbTip, pinkyMcp);
      const thumbMcpToPinkyDist = dist(thumbMcp, pinkyMcp);

      // Thumb is extended if its tip stretches away from palm base
      const isThumbExtended =
        thumbToPinkyDist > thumbMcpToPinkyDist * 1.18 &&
        dist(thumbTip, indexMcp) > dist(thumbIp, indexMcp);

      const states: FingerStates = {
        thumb: isThumbExtended,
        index: isIndexExtended,
        middle: isMiddleExtended,
        ring: isRingExtended,
        pinky: isPinkyExtended,
      };

      const nonThumbFingers = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended];
      const nonThumbCount = nonThumbFingers.filter(Boolean).length;
      const totalExtendedCount = nonThumbCount + (isThumbExtended ? 1 : 0);

      /**
       * Hand Cricket Mapping Specification:
       * - 0 extended fingers (fist) OR thumb-only = 6 (Street cricket rule)
       * - 1 to 5 extended fingers = 1 to 5 runs
       */
      let cricketNumber = 6;
      let label = 'Fist / Thumb = 6';

      if (totalExtendedCount === 0) {
        cricketNumber = 6;
        label = 'Closed Fist = 6 Runs';
      } else if (nonThumbCount === 0 && isThumbExtended) {
        cricketNumber = 6;
        label = 'Thumb Only = 6 Runs';
      } else if (totalExtendedCount >= 1 && totalExtendedCount <= 5) {
        cricketNumber = totalExtendedCount;
        label = `${totalExtendedCount} Finger${totalExtendedCount > 1 ? 's' : ''} = ${totalExtendedCount} Run${totalExtendedCount > 1 ? 's' : ''}`;
      } else {
        cricketNumber = 6;
        label = 'Full Palm = 6 Runs';
      }

      return { cricketNumber, states, label };
    },
    []
  );

  /**
   * Draw glowing neon hand landmarks onto overlay canvas
   */
  const drawLandmarks = useCallback(
    (landmarks: NormalizedLandmark[], canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const displayWidth = video.videoWidth || canvas.clientWidth || 640;
      const displayHeight = video.videoHeight || canvas.clientHeight || 480;

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17],
      ];

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 8;

      connections.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (!start || !end) return;

        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
        ctx.stroke();
      });

      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;

      landmarks.forEach((lm, idx) => {
        ctx.beginPath();
        const isTip = [4, 8, 12, 16, 20].includes(idx);
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, isTip ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = isTip ? '#ff007f' : '#ffffff';
        ctx.fill();
      });
    },
    []
  );

  // Main Detection Loop with timestamp protection and error recovery
  useEffect(() => {
    if (!isModelReady) return;

    let isRunning = true;

    const detectFrame = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current;

      // Verify video has actual dimensions and is currently playing
      if (video && landmarker && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) {
        try {
          // Strictly monotonic timestamp required by MediaPipe Tasks-Vision
          const now = performance.now();
          const frameTime = Math.max(now, lastTimeMsRef.current + 1);
          lastTimeMsRef.current = frameTime;

          const results = landmarker.detectForVideo(video, frameTime);

          if (results && results.landmarks && results.landmarks.length > 0) {
            setHandPresent(true);
            const landmarks = results.landmarks[0];
            const handedness = results.handednesses?.[0]?.[0]?.categoryName || 'Right';

            const { cricketNumber, states, label } = evaluateFingers(landmarks, handedness);

            setDetectedNumber(cricketNumber);
            setFingerStates(states);
            setGestureLabel(label);

            if (onDetect) {
              onDetect(cricketNumber);
            }

            if (isSamplingRef.current) {
              sampleBufferRef.current.push(cricketNumber);
            }

            if (canvasRef?.current) {
              drawLandmarks(landmarks, canvasRef.current, video);
            }
          } else {
            setHandPresent(false);
            setDetectedNumber(null);
            setGestureLabel('Show Hand to Camera');
            if (canvasRef?.current) {
              const ctx = canvasRef.current.getContext('2d');
              ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        } catch (frameErr) {
          // Guard against mobile WebGL frame drops or timing glitches
          console.warn('Frame detection skipped:', frameErr);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(detectFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(detectFrame);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isModelReady, evaluateFingers, drawLandmarks, onDetect, videoRef, canvasRef]);

  const startSampling = useCallback(() => {
    sampleBufferRef.current = [];
    isSamplingRef.current = true;
    setIsSampling(true);
  }, []);

  const stopSampling = useCallback((): number => {
    isSamplingRef.current = false;
    setIsSampling(false);

    const buffer = sampleBufferRef.current;
    if (buffer.length === 0) {
      return detectedNumber ?? Math.floor(Math.random() * 6) + 1;
    }

    const counts: Record<number, number> = {};
    let maxFreq = 0;
    let modeValue = buffer[0];

    for (const val of buffer) {
      counts[val] = (counts[val] || 0) + 1;
      if (counts[val] > maxFreq) {
        maxFreq = counts[val];
        modeValue = val;
      }
    }

    return modeValue;
  }, [detectedNumber]);

  return {
    isModelLoading,
    isModelReady,
    loadError,
    activeDelegate,
    detectedNumber,
    fingerStates,
    handPresent,
    gestureLabel,
    isSampling,
    startSampling,
    stopSampling,
  };
}
