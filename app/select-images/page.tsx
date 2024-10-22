"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { parseString } from "xml2js";
import {
  Chart as ChartJS,
  ScatterController,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import { XMarkIcon } from "@heroicons/react/24/solid";

ChartJS.register(ScatterController, LinearScale, PointElement, Tooltip);

interface Camera {
  $: { id: string; sensor_id: string; label: string };
  transform: string[];
}

interface Sensor {
  $: { id: string; label: string };
  resolution: { $: { width: string; height: string } }[];
  property: { $: { name: string; value: string } }[];
  calibration: { f: string[]; cx: string[]; cy: string[] }[];
}

export default function SelectImages() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [chartData, setChartData] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.name.endsWith(".xml")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const xmlContent = e.target?.result as string;
        parseString(xmlContent, (err, result) => {
          if (err) {
            console.error("Error parsing XML:", err);
            return;
          }
          const extractedCameras = result.document.chunk[0].cameras[0].camera;
          const extractedSensors = result.document.chunk[0].sensors[0].sensor;
          setCameras(extractedCameras);
          setSensors(extractedSensors);
          processData(extractedCameras, extractedSensors);
        });
      };
      reader.readAsText(file);
    }
  }, []);

  const processData = (cameras: Camera[], sensors: Sensor[]) => {
    const cameraPositions = cameras.map((camera) => {
      const transform = camera.transform[0].split(" ").map(Number);
      return {
        x: transform[3],
        y: transform[7],
        label: camera.$.label,
      };
    });

    setChartData({
      datasets: [
        {
          label: "Camera Positions",
          data: cameraPositions,
          backgroundColor: "rgba(173, 216, 230, 0.7)", // Light blue with some transparency
          pointRadius: 5,
        },
      ],
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/xml": [".xml"],
    },
  });

  const closeChart = () => {
    setChartData(null);
    setCameras([]);
    setSensors([]);
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-black text-white p-4">
      {!chartData ? (
        <div
          {...getRootProps()}
          className={`p-20 border-2 border-dashed rounded-lg text-center ${
            isDragActive ? "border-blue-500 bg-blue-900" : "border-gray-300"
          }`}
        >
          <input {...getInputProps()} />
          <p>
            {isDragActive
              ? "Drop the XML file here"
              : "Drag 'n' drop an XML file here, or click to select a file"}
          </p>
        </div>
      ) : (
        <div className="w-full h-full relative">
          <button
            onClick={closeChart}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-700 text-white font-bold p-2 rounded-full"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <div className="w-full h-[calc(100vh-2rem)]">
            <Scatter
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    type: "linear",
                    position: "bottom",
                    grid: {
                      color: "rgba(173, 216, 230, 0.3)", // Light blue with low opacity
                    },
                    ticks: {
                      color: "rgba(173, 216, 230, 0.7)", // Light blue for axis labels
                    },
                  },
                  y: {
                    type: "linear",
                    position: "left",
                    grid: {
                      color: "rgba(173, 216, 230, 0.3)", // Light blue with low opacity
                    },
                    ticks: {
                      color: "rgba(173, 216, 230, 0.7)", // Light blue for axis labels
                    },
                  },
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (context: any) =>
                        `${context.raw.label} (${context.raw.x.toFixed(
                          2
                        )}, ${context.raw.y.toFixed(2)})`,
                    },
                  },
                  legend: {
                    display: false, // Hide the legend
                  },
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
