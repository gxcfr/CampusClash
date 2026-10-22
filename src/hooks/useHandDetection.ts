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
  const [gestureLabel, setGestureLabel] = useState<string>('No Hand Detected');

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
      let isThumbExtended = false;
      const isHandRight = handedness.toLowerCase().includes('right');

      const thumbToPinkyDist = Math.hypot(thumbTip.x - pinkyMcp.x, thumbTip.y - pinkyMcp.y);
      const thumbMcpToPinkyDist = Math.hypot(thumbMcp.x - pinkyMcp.x, thumbMcp.y - pinkyMcp.y);

      if (isHandRight) {
        isThumbExtended = thumbTip.x < thumbIp.x || thumbToPinkyDist > thumbMcpToPinkyDist * 1.15;
      } else {
        isThumbExtended = thumbTip.x > thumbIp.x || thumbToPinkyDist > thumbMcpToPinkyDist * 1.15;
      }

      if (thumbTip.y > wrist.y + 0.05) {
        isThumbExtended = false;
      }

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

  // Main Detection Loop - Never stalls if videoRef.current mounts dynamically!
  useEffect(() => {
    if (!isModelReady) return;

    let lastVideoTime = -1;

    const detectFrame = () => {
      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current;

      if (video && landmarker && video.readyState >= 2 && !video.paused) {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const startTimeMs = performance.now();
          const results = landmarker.detectForVideo(video, startTimeMs);

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
            setGestureLabel('No Hand Detected');
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
    detectedNumber,
    fingerStates,
    handPresent,
    gestureLabel,
    isSampling,
    startSampling,
    stopSampling,
  };
}
