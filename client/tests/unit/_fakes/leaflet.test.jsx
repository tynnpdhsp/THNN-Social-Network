import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { createReactLeafletStub } from './leaflet.jsx';

describe('createReactLeafletStub', () => {
  let stub;

  beforeEach(() => {
    delete globalThis.__lastMapHandlers;
    stub = createReactLeafletStub();
  });

  it('MapContainer_forwards_center_zoom_and_children', () => {
    const { MapContainer } = stub;
    render(
      <MapContainer center={[1, 2]} zoom={14}>
        <span>child</span>
      </MapContainer>,
    );
    const el = screen.getByTestId('leaflet-map-container');
    expect(el).toHaveTextContent('child');
    expect(el.getAttribute('data-center')).toBe(JSON.stringify([1, 2]));
    expect(el.getAttribute('data-zoom')).toBe('14');
  });

  it('TileLayer_exposes_url', () => {
    const { MapContainer, TileLayer } = stub;
    render(
      <MapContainer>
        <TileLayer url="https://tile/{z}/{x}/{y}.png" />
      </MapContainer>,
    );
    expect(screen.getByTestId('leaflet-tile-layer').getAttribute('data-url')).toContain('tile');
  });

  it('Marker_serializes_position_and_Popup_renders_children', () => {
    const { MapContainer, Marker, Popup } = stub;
    render(
      <MapContainer>
        <Marker position={[10.5, 106.6]}>
          <Popup>Hi</Popup>
        </Marker>
      </MapContainer>,
    );
    expect(screen.getByTestId('leaflet-marker').getAttribute('data-position')).toBe(
      JSON.stringify([10.5, 106.6]),
    );
    expect(screen.getByTestId('leaflet-popup')).toHaveTextContent('Hi');
  });

  it('useMapEvents_registers_handlers_on_globalThis', () => {
    const { MapContainer, useMapEvents } = stub;
    const click = vi.fn();
    function Inner() {
      useMapEvents({ click });
      return null;
    }
    render(
      <MapContainer>
        <Inner />
      </MapContainer>,
    );
    expect(globalThis.__lastMapHandlers).toBeDefined();
    expect(globalThis.__lastMapHandlers.click).toBe(click);
  });

  it('useMap_returns_flyTo_that_can_be_invoked', () => {
    const { MapContainer, useMap } = stub;
    let flyTo;
    function Inner() {
      const m = useMap();
      flyTo = m.flyTo;
      return null;
    }
    render(
      <MapContainer>
        <Inner />
      </MapContainer>,
    );
    expect(flyTo).toBeDefined();
    flyTo([10, 20], 12, { duration: 1 });
    expect(flyTo).toHaveBeenCalledWith([10, 20], 12, { duration: 1 });
  });
});
