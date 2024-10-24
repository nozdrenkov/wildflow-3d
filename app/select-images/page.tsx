/* eslint-disable */
"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { parseString } from "xml2js";
import {
  Chart as ChartJS,
  ScatterController,
  LinearScale,
  PointElement,
  Tooltip,
  ChartOptions,
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
}

interface SensorState {
  id: string;
  label: string;
  color: string;
  isSelected: boolean;
  imageCount: number;
}

const colors = [
  "rgba(255, 99, 132, 0.7)",
  "rgba(54, 162, 235, 0.7)",
  "rgba(255, 206, 86, 0.7)",
  "rgba(75, 192, 192, 0.7)",
  "rgba(153, 102, 255, 0.7)",
  "rgba(255, 159, 64, 0.7)",
];

export default function SelectImages() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [sensors, setSensors] = useState<SensorState[]>([]);
  const [chartBounds, setChartBounds] = useState<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [useGlobalCoordinates, setUseGlobalCoordinates] = useState(true);

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
          console.log("Parsed XML result:", result);
          setResult(result);
          const extractedCameras = result.document.chunk[0].cameras[0].camera;
          const extractedSensors = result.document.chunk[0].sensors[0].sensor;
          setCameras(extractedCameras);
          setSensors(
            extractedSensors.map((sensor: any, index: number) => {
              const sensorCameras = extractedCameras.filter(
                (camera: Camera) => camera.$.sensor_id === sensor.$.id
              );
              return {
                id: sensor.$.id,
                label: sensor.$.label,
                color: colors[index % colors.length],
                isSelected: true,
                imageCount: sensorCameras.length,
              };
            })
          );
        });
      };
      reader.readAsText(file);
    }
  }, []);

  const chartDataMemo = useMemo(() => {
    if (cameras.length === 0 || sensors.length === 0 || !result) return null;

    // Extract the chunk transformation
    const chunkTransform = result.document.chunk[0].transform[0];
    const rotation = chunkTransform.rotation[0]._.split(" ").map(Number);
    const translation = chunkTransform.translation[0]._.split(" ").map(Number);
    const scale = parseFloat(chunkTransform.scale[0]._);

    // Create the chunk transformation matrix
    const chunkMatrix = [
      [rotation[0], rotation[1], rotation[2], translation[0]],
      [rotation[3], rotation[4], rotation[5], translation[1]],
      [rotation[6], rotation[7], rotation[8], translation[2]],
      [0, 0, 0, 1],
    ];

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    const datasets = sensors.map((sensor) => {
      const sensorData = cameras
        .filter((camera) => camera.$.sensor_id === sensor.id)
        .map((camera) => {
          const cameraTransform = camera.transform[0].split(" ").map(Number);
          let x, y;

          if (useGlobalCoordinates) {
            const cameraMatrix = [
              [
                cameraTransform[0],
                cameraTransform[1],
                cameraTransform[2],
                cameraTransform[3],
              ],
              [
                cameraTransform[4],
                cameraTransform[5],
                cameraTransform[6],
                cameraTransform[7],
              ],
              [
                cameraTransform[8],
                cameraTransform[9],
                cameraTransform[10],
                cameraTransform[11],
              ],
              [0, 0, 0, 1],
            ];

            // Apply chunk transformation to camera transformation
            const globalMatrix = multiplyMatrices(chunkMatrix, cameraMatrix);

            // Extract and scale the X and Y coordinates
            x = globalMatrix[0][3] * scale;
            y = globalMatrix[1][3] * scale;
          } else {
            // Use local coordinates
            x = cameraTransform[3];
            y = cameraTransform[7];
          }

          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);

          return { x, y, label: camera.$.label };
        });

      return {
        label: `${sensor.id}: ${sensor.label}`,
        data: sensorData,
        backgroundColor: sensor.color,
        pointRadius: 5,
      };
    });

    // Add 10% margin to bounds
    const xMargin = (maxX - minX) * 0.1;
    const yMargin = (maxY - minY) * 0.1;
    setChartBounds({
      minX: minX - xMargin,
      maxX: maxX + xMargin,
      minY: minY - yMargin,
      maxY: maxY + yMargin,
    });

    return { datasets };
  }, [cameras, sensors, result, useGlobalCoordinates]);

  // Helper function to multiply two matrices
  function multiplyMatrices(a: number[][], b: number[][]) {
    return a.map((row, i) =>
      b[0].map((_, j) => row.reduce((acc, _, n) => acc + a[i][n] * b[n][j], 0))
    );
  }

  const toggleSensor = useCallback((id: string) => {
    setSensors((prevSensors) =>
      prevSensors.map((sensor) =>
        sensor.id === id
          ? { ...sensor, isSelected: !sensor.isSelected }
          : sensor
      )
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  });

  const chartOptions: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
    scales: {
      x: {
        type: "linear",
        position: "bottom",
        min: chartBounds?.minX,
        max: chartBounds?.maxX,
        grid: {
          color: "rgba(173, 216, 230, 0.3)",
        },
        ticks: {
          color: "rgba(173, 216, 230, 0.7)",
        },
      },
      y: {
        type: "linear",
        position: "left",
        min: chartBounds?.minY,
        max: chartBounds?.maxY,
        grid: {
          color: "rgba(173, 216, 230, 0.3)",
        },
        ticks: {
          color: "rgba(173, 216, 230, 0.7)",
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
        display: false,
      },
    },
  };

  return (
    <div className="h-screen w-full bg-black p-4 flex items-center justify-center">
      {!chartDataMemo ? (
        <div
          {...getRootProps()}
          className={`p-20 border-2 border-dashed rounded-lg text-center ${
            isDragActive ? "border-blue-500 bg-blue-900" : "border-gray-300"
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-white">
            {isDragActive
              ? "Drop the XML file here"
              : "Drag 'n' drop an XML file here, or click to select a file"}
          </p>
        </div>
      ) : (
        <div className="w-full h-full relative">
          <button
            onClick={() => {
              setCameras([]);
              setSensors([]);
            }}
            className="absolute top-4 right-4 z-10 bg-red-500 hover:bg-red-700 text-white font-bold p-2 rounded-full"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <div className="w-full h-full">
            <Scatter
              data={{
                datasets: chartDataMemo.datasets.filter(
                  (dataset: any) =>
                    sensors.find(
                      (sensor) =>
                        `${sensor.id}: ${sensor.label}` === dataset.label
                    )?.isSelected
                ),
              }}
              options={chartOptions}
            />
          </div>
          <div className="absolute top-0 left-0 bg-black bg-opacity-80 rounded-lg">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="globalToggle"
                checked={useGlobalCoordinates}
                onChange={() => setUseGlobalCoordinates(!useGlobalCoordinates)}
                className="mr-2"
              />
              <label htmlFor="globalToggle" className="text-white text-xs">
                Global Coordinates
              </label>
            </div>
            {sensors.map((sensor) => (
              <div key={sensor.id} className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id={sensor.id}
                  checked={sensor.isSelected}
                  onChange={() => toggleSensor(sensor.id)}
                  className="mr-2"
                />
                <label
                  htmlFor={sensor.id}
                  className="flex items-center text-white text-xs"
                >
                  <span
                    className="w-3 h-3 inline-block mr-2"
                    style={{ backgroundColor: sensor.color }}
                  ></span>
                  {`${sensor.id}: ${sensor.label} | ${sensor.imageCount} pics`}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
