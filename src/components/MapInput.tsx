import React, { useState } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// This part of the fix is still necessary.
delete L.Icon.Default.prototype._getIconUrl;

// Now we use the imported variables instead of require().
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});
// --- END OF CORRECTION ---

// This component will capture the click event
function RegionFinder({ onRegionSelect }) {
  const map = useMapEvents({
    click(e) {
      onRegionSelect(e.latlng); // Pass the lat/lng object up to the parent
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  return null;
}

export const MapInput = ({ onRegionSelect }) => {
  const [center, setCenter] = useState(null);
  
  const REGION_RADIUS_METERS = 5000;
  const circleOptions = { color: 'blue', fillColor: 'blue' };

  const handleRegionSelect = (latlng) => {
    setCenter(latlng);
    // Pass up the center and the radius as a single object
    onRegionSelect({
        lat: latlng.lat,
        lng: latlng.lng,
        radius: REGION_RADIUS_METERS
    });
  };

  return (
    <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
            Observation Region (Optional)
        </label>
        <p className="text-xs text-gray-500 mb-2">Click on the map to define the center of a 5km radius region.</p>
        <div style={{ height: '250px', width: '100%' }} className="rounded-lg overflow-hidden border border-gray-600">
            <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <RegionFinder onRegionSelect={handleRegionSelect} />
                {center && <Circle center={center} radius={REGION_RADIUS_METERS} pathOptions={circleOptions} />}
            </MapContainer>
        </div>
        {center && (
            <p className="text-xs text-gray-400 mt-2">
                Region Center: Lat: {center.lat.toFixed(4)}, Lng: {center.lng.toFixed(4)}
            </p>
        )}
    </div>
  );
};