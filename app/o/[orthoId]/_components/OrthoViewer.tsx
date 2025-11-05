"use client";

import { useEffect, useRef, useState } from "react";

interface OrthoViewerProps {
  orthoId: string;
}

interface Survey {
  id: string;
  site: string;
  lat: number;
  lon: number;
}

export default function OrthoViewer({ orthoId }: OrthoViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [siteSurveys, setSiteSurveys] = useState<Survey[]>([]);

  const isSoneva = orthoId.startsWith("soneva");

  useEffect(() => {
    if (isSoneva) {
      import("../../../soneva/surveys").then(({ surveys }) => {
        const filtered = surveys
          .filter(s => s.id.substring(0, s.id.lastIndexOf('_')) === orthoId.substring(0, orthoId.lastIndexOf('_')))
          .sort((a, b) => b.id.localeCompare(a.id));
        setSiteSurveys(filtered);
      });
    }
  }, [isSoneva, orthoId]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      if (!mapRef.current) return;
      
      const L = await import("leaflet");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("leaflet/dist/leaflet.css");
      
      const newUrl = `https://storage.googleapis.com/wildflow/${orthoId}/mesh_ortho_xyz/metadata.json`;
      const oldUrl = `https://storage.googleapis.com/wildflow/orthos/${orthoId}/metadata.json`;
      
      let meta;
      let baseUrl;
      
      const newRes = await fetch(newUrl, { cache: "no-store" });
      if (newRes.ok) {
        meta = await newRes.json();
        baseUrl = `https://storage.googleapis.com/wildflow/${orthoId}/mesh_ortho_xyz/`;
      } else {
        const oldRes = await fetch(oldUrl, { cache: "no-store" });
        if (oldRes.ok) {
          meta = await oldRes.json();
          baseUrl = `https://storage.googleapis.com/wildflow/orthos/${orthoId}/`;
        } else {
          meta = { width: 4096, height: 4096, tileSize: 256, minZoom: 0, maxZoom: 6 };
          baseUrl = `https://storage.googleapis.com/wildflow/orthos/${orthoId}/`;
        }
      }

      if (!mapRef.current) return;

      const { width, height, tileSize = 256, minZoom = 0, maxZoom = 6 } = meta;

      const map = L.map(mapRef.current, {
        crs: L.CRS.Simple,
        zoomControl: true,
        minZoom,
        maxZoom,
        inertia: true,
        wheelPxPerZoomLevel: 120,
        attributionControl: false,
      });

      const imageBounds = L.latLngBounds(
        map.unproject([0, height], maxZoom),
        map.unproject([width, 0], maxZoom)
      );
      
      map.fitBounds(imageBounds);

      const layer = L.tileLayer("", {
        tileSize,
        minZoom,
        maxZoom,
        noWrap: true,
        errorTileUrl: `${baseUrl}blank.png`,
        bounds: imageBounds,
        minNativeZoom: minZoom,
        maxNativeZoom: maxZoom,
      });

      layer.getTileUrl = function (coords) {
        return `${baseUrl}${coords.z}/${coords.y}/${coords.x}.webp`;
      };

      layer.addTo(map);

      map.touchZoom.enable();
      map.boxZoom.disable();
      map.keyboard.disable();
      map.setMaxBounds(imageBounds);

      mapInstanceRef.current = map;
    };

    const timeoutId = setTimeout(initMap, 0);

    return () => {
      clearTimeout(timeoutId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [orthoId]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ background: "#000" }}
      />
      {isSoneva && siteSurveys.length > 0 && (
        <div className="absolute top-4 right-4 bg-black/70 text-white p-3 rounded text-sm z-[1000]">
          {siteSurveys.map(s => {
            const date = s.id.split('_').pop()!;
            const formatted = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
            const isCurrent = s.id === orthoId;
            return (
              <div key={s.id} className="mb-1">
                {isCurrent ? (
                  <span style={{ fontWeight: 900 }} className="text-white">{formatted}</span>
                ) : (
                  <a href={`/o/${s.id}`} style={{ fontWeight: 300 }} className="hover:underline text-blue-300">
                    {formatted}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
