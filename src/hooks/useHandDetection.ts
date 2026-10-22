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
}

export function useHandDetection({ videoRef, canvasRef, onDetect }: UseHandDetectionOptions) {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const sampleBufferRef = useRef<number[]>([]);
  const isSamplingRef = useRef(false);

  // Initialize MediaPipe Tasks-Vision HandLandmarker via official CDN WASM assets
  useEffect(() => {
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

        // Create HandLandmarker with GPU delegate and single hand detection for high-FPS edge CV
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (isCancelled) {
          landmarker.close();
          return;
        }

        handLandmarkerRef.current = landmarker;
        setIsModelReady(true);
        setIsModelLoading(false);
      } catch (err: any) {
        console.error('Failed to load MediaPipe HandLandmarker:', err);
        if (!isCancelled) {
          setLoadError(err?.message || 'Failed to initialize edge computer vision');
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
   * Robust Finger Counting & Hand Cricket Number Extraction Logic
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
      const thumbTip = landmarks[4];
      const thumbIp = landmarks[3];
      const thumbMcp = landmarks[2];

      const indexTip = landmarks[8];
      const indexPip = landmarks[6];

      const middleTip = landmarks[12];
      const middlePip = landmarks[10];

      const ringTip = landmarks[16];
      const ringPip = landmarks[14];

      const pinkyTip = landmarks[20];
      const pinkyPip = landmarks[18];
      const pinkyMcp = landmarks[17];

      // 1. Index, Middle, Ring, Pinky extended check:
      // In web viewport, y increases downward. So tip.y < pip.y means finger points up.
      const isIndexExtended = indexTip.y < indexPip.y;
      const isMiddleExtended = middleTip.y < middlePip.y;
      const isRingExtended = ringTip.y < ringPip.y;
      const isPinkyExtended = pinkyTip.y < pinkyPip.y;

      // 2. Thumb extended check:
      // Uses tip vs IP x-coordinate and distance from pinky MCP to ensure robustness
      // across left/right hands and mirrored selfie feeds.
      let isThumbExtended = false;
      const isHandRight = handedness.toLowerCase().includes('right');

      // Distance test: if thumb tip is far away from palm/pinky base
      const thumbToPinkyDist = Math.hypot(thumbTip.x - pinkyMcp.x, thumbTip.y - pinkyMcp.y);
      const thumbMcpToPinkyDist = Math.hypot(thumbMcp.x - pinkyMcp.x, thumbMcp.y - pinkyMcp.y);

      if (isHandRight) {
        isThumbExtended = thumbTip.x < thumbIp.x || thumbToPinkyDist > thumbMcpToPinkyDist * 1.15;
      } else {
        isThumbExtended = thumbTip.x > thumbIp.x || thumbToPinkyDist > thumbMcpToPinkyDist * 1.15;
      }

      // Also confirm thumb is not curled down against palm
      if (thumbTip.y > wrist.y) {
        isThumbExtended = false;
      }

      const states: FingerStates = {
        thumb: isThumbExtended,
        index: isIndexExtended,
        middle: isMiddleExtended,
        ring: isRingExtended,
        pinky: isPinkyExtended,
      };

      // Count four main fingers
      const nonThumbFingers = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended];
      const nonThumbCount = nonThumbFingers.filter(Boolean).length;
      const totalExtendedCount = nonThumbCount + (isThumbExtended ? 1 : 0);

      /**
       * Hand Cricket Mapping Specification:
       * - 0 extended fingers (fist) OR thumb-only = 6 (Classic street cricket rule!)
       * - 1 finger extended = 1
       * - 2 fingers extended = 2
       * - 3 fingers extended = 3
       * - 4 fingers extended = 4
       * - 5 fingers extended = 5
       */
      let cricketNumber = 6;

      if (totalExtendedCount === 0 || (nonThumbCount === 0 && isThumbExtended)) {
        cricketNumber = 6;
      } else if (totalExtendedCount >= 1 && totalExtendedCount <= 5) {
        cricketNumber = totalExtendedCount;
      } else {
        cricketNumber = 6;
      }

      return { cricketNumber, states };
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

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // MediaPipe Hand Landmark Connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],       // Index
        [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],// Ring
        [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
        [5, 9], [9, 13], [13, 17],            // Palm knuckle base
      ];

      // Draw connection lines with neon cyan glow
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 10;

      connections.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (!start || !end) return;

        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
        ctx.stroke();
      });

      // Draw landmark joints with hot pink glow
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 12;

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

  // Main Detection Loop
  useEffect(() => {
    if (!isModelReady || !videoRef.current) return;

    let lastVideoTime = -1;

    const detectFrame = () => {
      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current;

      if (video && landmarker && video.readyState >= 2) {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const startTimeMs = performance.now();
          const results = landmarker.detectForVideo(video, startTimeMs);

          if (results && results.landmarks && results.landmarks.length > 0) {
            setHandPresent(true);
            const landmarks = results.landmarks[0];
            const handedness = results.handednesses?.[0]?.[0]?.categoryName || 'Right';

            const { cricketNumber, states } = evaluateFingers(landmarks, handedness);

            setDetectedNumber(cricketNumber);
            setFingerStates(states);

            if (onDetect) {
              onDetect(cricketNumber);
            }

            // If actively sampling in the final 2 seconds of countdown, push to buffer
            if (isSamplingRef.current) {
              sampleBufferRef.current.push(cricketNumber);
            }

            // Draw to canvas overlay if available
            if (canvasRef?.current) {
              drawLandmarks(landmarks, canvasRef.current, video);
            }
          } else {
            setHandPresent(false);
            setDetectedNumber(null);
            if (canvasRef?.current) {
              const ctx = canvasRef.current.getContext('2d');
              ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(detectFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(detectFrame);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isModelReady, evaluateFingers, drawLandmarks, onDetect, videoRef, canvasRef]);

  /**
   * Start 2-second sampling window
   */
  const startSampling = useCallback(() => {
    sampleBufferRef.current = [];
    isSamplingRef.current = true;
    setIsSampling(true);
  }, []);

  /**
   * Stop sampling and return statistical mode (most frequent number 1..6)
   */
  const stopSampling = useCallback((): number => {
    isSamplingRef.current = false;
    setIsSampling(false);

    const buffer = sampleBufferRef.current;
    if (buffer.length === 0) {
      // Fallback to instantaneous detected number or a sensible 1..6
      return detectedNumber ?? Math.floor(Math.random() * 6) + 1;
    }

    // Frequency map for statistical mode
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
    detectedNumber,
    fingerStates,
    handPresent,
    isSampling,
    startSampling,
    stopSampling,
  };
}
