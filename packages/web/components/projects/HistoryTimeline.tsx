"use client";

import { useCallback, useState } from "react";
import { useProjectSnapshot } from "@/lib/hooks/history";

interface HistoryTimelineProps {
  projectID: string;
  currentSeq: number;
  onPreview: (elements: string) => void;
  onRestore: (elements: string) => void;
  onClose: () => void;
}

export default function HistoryTimeline({
  projectID,
  currentSeq,
  onPreview,
  onRestore,
  onClose,
}: HistoryTimelineProps) {
  const [sliderValue, setSliderValue] = useState(currentSeq);
  const [previewTimestamp, setPreviewTimestamp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchSnapshot] = useProjectSnapshot();

  const handleSliderChange = useCallback(
    async (value: number) => {
      setSliderValue(value);
      if (value === currentSeq) {
        setPreviewTimestamp(null);
        return;
      }

      setIsLoading(true);
      try {
        const { data } = await fetchSnapshot({
          variables: { projectID, seq: value },
        });
        if (data?.projectSnapshotAt) {
          onPreview(data.projectSnapshotAt.elements);
          setPreviewTimestamp(data.projectSnapshotAt.timestamp);
        }
      } catch (err) {
        console.error("Failed to fetch snapshot:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [projectID, currentSeq, fetchSnapshot, onPreview],
  );

  const handleRestore = useCallback(async () => {
    if (sliderValue === currentSeq) return;

    setIsLoading(true);
    try {
      const { data } = await fetchSnapshot({
        variables: { projectID, seq: sliderValue },
      });
      if (data?.projectSnapshotAt) {
        onRestore(data.projectSnapshotAt.elements);
      }
    } catch (err) {
      console.error("Failed to restore snapshot:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sliderValue, currentSeq, projectID, fetchSnapshot, onRestore]);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-gray-200 px-6 py-4 w-[600px] max-w-[90vw]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">History Timeline</h3>
        <div className="flex items-center gap-2">
          {previewTimestamp && (
            <span className="text-xs text-gray-500">
              {new Date(previewTimestamp).toLocaleString()}
            </span>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            x
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-6">0</span>
        <input
          type="range"
          min={0}
          max={currentSeq}
          value={sliderValue}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          disabled={isLoading || currentSeq === 0}
        />
        <span className="text-xs text-gray-400 w-10 text-right">{currentSeq}</span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-500">
          Viewing: seq {sliderValue}
          {sliderValue === currentSeq ? " (current)" : ""}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSliderValue(currentSeq);
              setPreviewTimestamp(null);
              onClose();
            }}
            className="px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={sliderValue === currentSeq || isLoading}
            className="px-3 py-1 text-xs rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Loading..." : "Restore"}
          </button>
        </div>
      </div>
    </div>
  );
}
