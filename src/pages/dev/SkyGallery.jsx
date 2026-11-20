import { SkyBanner } from '../../components/SkyBanner';

// Development only (/dev/sky): every sky the dashboard can show, by day and
// by night, side by side and moving, to check them without waiting for the
// weather. Not part of the built site.
const SKIES = [
  ['clear', 'Clear sky'],
  ['partly', 'Partly cloudy'],
  ['cloudy', 'Overcast'],
  ['fog', 'Fog'],
  ['drizzle', 'Drizzle'],
  ['rain', 'Rain'],
  ['thunder', 'Thunderstorm'],
  ['snow', 'Snow'],
];

export default function SkyGallery() {
  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-ink sm:px-8">
      <h1 className="text-2xl">Every sky</h1>
      <p className="mt-1 text-sm text-muted">The dashboard's weather band, by day and by night. Development only.</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {SKIES.flatMap(([sky, label]) =>
          ['day', 'night'].map((time) => (
            <figure key={`${sky}-${time}`} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              <SkyBanner
                className="h-36"
                preview={{
                  available: true,
                  sky,
                  label,
                  isDay: time === 'day',
                  temperature: time === 'day' ? 31 : 24,
                  location: 'Bhubaneswar, Odisha',
                  observedAt: '',
                }}
              />
              <figcaption className="px-4 py-2.5 text-sm font-medium">
                {label}, {time}
              </figcaption>
            </figure>
          )),
        )}
      </div>
    </main>
  );
}
