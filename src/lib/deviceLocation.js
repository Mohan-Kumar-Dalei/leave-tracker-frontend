import { useSyncExternalStore } from 'react';

// The person's rough location, for the weather on the dashboard. The app asks
// for it once, as soon as it opens after signing in (askForLocation, called
// from AppShell); the browser shows its own "allow location" prompt the first
// time and remembers the answer for the site after that. Only a rounded
// position (about 10 km) is kept and ever sent to the server. Without it (no
// answer yet, a "Block", or no location on the device) the weather is
// Bhubaneswar, Odisha.

let state = { coords: null, status: 'idle' }; // idle, asking, granted, denied, unsupported
const listeners = new Set();
let started = false;

const update = (next) => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};

const roughly = (value) => Math.round(value * 10) / 10;

export function askForLocation() {
  if (started) return;
  started = true;
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    update({ status: 'unsupported' });
    return;
  }
  update({ status: 'asking' });
  navigator.geolocation.getCurrentPosition(
    (position) =>
      update({
        status: 'granted',
        coords: { lat: roughly(position.coords.latitude), lon: roughly(position.coords.longitude) },
      }),
    () => update({ status: 'denied', coords: null }),
    { maximumAge: 30 * 60 * 1000, timeout: 15000, enableHighAccuracy: false },
  );
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

export function useDeviceLocation() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
