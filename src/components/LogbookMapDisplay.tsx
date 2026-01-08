import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapIcon } from '@heroicons/react/24/solid';

export const LogbookMapDisplay = ({ ipfsHash }) => {
    const [locationData, setLocationData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!ipfsHash) return;

        const fetchAndParseLocation = async () => {
            try {
                // We must fetch the main artifact ZIP first to find the location file
                const zipGatewayUrl = `https://dweb.link/ipfs/${ipfsHash}`;
                const zipResponse = await fetch(zipGatewayUrl);
                if (!zipResponse.ok) throw new Error("Could not fetch main artifact ZIP.");

                const JSZip = (await import('jszip')).default;
                const zipBlob = await zipResponse.blob();
                const zip = await JSZip.loadAsync(zipBlob);

                // Now, look for 'location.json' inside the zip
                const locationFile = zip.file("location.json");
                if (locationFile) {
                    const locationContent = await locationFile.async("string");
                    setLocationData(JSON.parse(locationContent));
                }
                // If no location file is found, we just do nothing.
                
            } catch (e) {
                setError(e.message);
            }
        };

        fetchAndParseLocation();
    }, [ipfsHash]);

    // If there's no location data, render nothing.
    if (!locationData) {
        return null;
    }

    if (error) {
        return <p className="text-xs text-red-400">Error loading map: {error}</p>;
    }
    
    // Assuming a 'Circle' type from our previous implementation
    const center = [locationData.center.latitude, locationData.center.longitude];
    const radius = locationData.radius_meters;
    const circleOptions = { color: '#3498db', fillColor: '#3498db', fillOpacity: 0.3 };

    return (
        <div className="mt-4">
            <h4 className="font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-gray-400"/>
                Observation Region
            </h4>
            <div style={{ height: '200px', width: '100%' }} className="rounded-lg overflow-hidden border border-gray-600">
                <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <Circle center={center} radius={radius} pathOptions={circleOptions} />
                </MapContainer>
            </div>
        </div>
    );
};