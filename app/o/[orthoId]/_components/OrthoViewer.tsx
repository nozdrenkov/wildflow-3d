"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface OrthoViewerProps {
  orthoId: string;
}

export default function OrthoViewer({ orthoId }: OrthoViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      if (!mapRef.current) return;
      
      const baseUrl = "https://storage.googleapis.com/wildflow/orthos/";
      const metadataUrl = `${baseUrl}${orthoId}/metadata.json`;
      
      let meta;
      try {
        const res = await fetch(metadataUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load metadata.json");
        meta = await res.json();
      } catch (e) {
        meta = { width: 4096, height: 4096, tileSize: 256, minZoom: 0, maxZoom: 6 };
        console.warn("metadata.json missing; using fallback", e);
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
        errorTileUrl: `${baseUrl}${orthoId}/blank.png`,
        bounds: imageBounds,
        minNativeZoom: minZoom,
        maxNativeZoom: maxZoom,
      });

      layer.getTileUrl = function (coords) {
        return `${baseUrl}${orthoId}/${coords.z}/${coords.y}/${coords.x}.webp`;
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
    <div 
      ref={mapRef} 
      className="w-full h-full"
      style={{ background: "#000" }}
    />
  );
}
