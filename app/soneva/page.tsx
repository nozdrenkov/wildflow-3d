'use client';

import { useRef } from 'react';
import Script from 'next/script';
import { surveys } from './surveys';

export default function SonevaMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  const latestSurveys = surveys.reduce((acc, survey) => {
    const existing = acc.find(s => s.site === survey.site && s.id.split('_')[1] === survey.id.split('_')[1]);
    if (!existing) {
      acc.push(survey);
    } else {
      const existingDate = parseInt(existing.id.split('_')[2]);
      const currentDate = parseInt(survey.id.split('_')[2]);
      if (currentDate > existingDate) {
        const index = acc.indexOf(existing);
        acc[index] = survey;
      }
    }
    return acc;
  }, [] as typeof surveys);

  const initMap = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!mapRef.current || !(window as any).google) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;

    const centerLat = latestSurveys.reduce((sum, s) => sum + s.lat, 0) / latestSurveys.length;
    const centerLng = latestSurveys.reduce((sum, s) => sum + s.lon, 0) / latestSurveys.length;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 17,
      center: { lat: centerLat, lng: centerLng },
      mapTypeId: 'satellite',
      disableDefaultUI: false,
      styles: [{ featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
    });

    latestSurveys.forEach(survey => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: survey.lat, lng: survey.lon },
        title: survey.site,
      });

      const overlay = new google.maps.OverlayView();
      overlay.onAdd = function() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.color = 'white';
        div.style.fontSize = '12px';
        div.style.fontWeight = 'bold';
        div.style.textAlign = 'center';
        div.style.whiteSpace = 'nowrap';
        div.style.cursor = 'pointer';
        div.style.textShadow = '1px 1px 2px black';
        div.textContent = survey.site;
        div.onclick = () => window.location.href = `/o/${survey.id}`;
        this.getPanes()!.overlayLayer.appendChild(div);
        this.div = div;
      };
      overlay.draw = function() {
        const projection = this.getProjection();
        const position = projection.fromLatLngToDivPixel(marker.getPosition()!);
        const div = this.div as HTMLElement;
        div.style.left = position.x + 'px';
        div.style.top = (position.y + 5) + 'px';
        div.style.transform = 'translateX(-50%)';
      };
      overlay.onRemove = function() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          delete this.div;
        }
      };
      overlay.setMap(map);

      marker.addListener('click', () => {
        window.location.href = `/o/${survey.id}`;
      });
    });
  };

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
        onLoad={initMap}
      />
      <div className="w-full h-screen">
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </>
  );
}

