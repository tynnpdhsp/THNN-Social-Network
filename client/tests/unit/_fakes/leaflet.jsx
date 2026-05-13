import React from 'react';
import { vi } from 'vitest';

/**
 * Stub implementations for `react-leaflet` in unit tests.
 * Use with: `vi.mock('react-leaflet', () => createReactLeafletStub())` inside the test file
 * (dynamic factory so each test file gets fresh `vi.fn()` instances if needed).
 *
 * Last `useMapEvents` handler map is stored on `globalThis.__lastMapHandlers` for assertions.
 */
export function createReactLeafletStub() {
  const MapContainer = ({ children, center, zoom, ...rest }) => (
    <div data-testid="leaflet-map-container" data-center={center ? JSON.stringify(center) : ''} data-zoom={zoom ?? ''} {...rest}>
      {children}
    </div>
  );

  const TileLayer = ({ url }) => <div data-testid="leaflet-tile-layer" data-url={url || ''} />;

  const Marker = ({ children, position, ...rest }) => (
    <div data-testid="leaflet-marker" data-position={position ? JSON.stringify(position) : ''} {...rest}>
      {children}
    </div>
  );

  const Popup = ({ children }) => <div data-testid="leaflet-popup">{children}</div>;

  const useMap = () => ({
    flyTo: vi.fn(),
    setView: vi.fn(),
    getZoom: () => 13,
    getCenter: () => ({ lat: 0, lng: 0 }),
  });

  const useMapEvents = (handlers) => {
    globalThis.__lastMapHandlers = handlers;
    return null;
  };

  return {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
    useMapEvents,
  };
}
