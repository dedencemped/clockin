import React, { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check } from "lucide-react";

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("user");

  const startCamera = useCallback(async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [facingMode]);

  const takePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setPhoto(dataUrl);
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  const retake = () => {
    setPhoto(null);
    startCamera();
  };

  const confirm = () => {
    onCapture(photo);
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-foreground/5 aspect-[4/3]">
        {!photo ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <img src={photo} alt="Captured" className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="flex gap-2 justify-center">
        {!photo ? (
          <>
            <Button onClick={takePhoto} className="gap-2">
              <Camera className="w-4 h-4" /> Ambil Foto
            </Button>
            <Button variant="outline" onClick={onCancel}>Batal</Button>
          </>
        ) : (
          <>
            <Button onClick={confirm} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              <Check className="w-4 h-4" /> Gunakan
            </Button>
            <Button variant="outline" onClick={retake} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Ulangi
            </Button>
          </>
        )}
      </div>
    </div>
  );
}