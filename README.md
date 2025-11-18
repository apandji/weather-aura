# Weather Aura Generator

A simple web prototype that generates visual "weather auras" based on atmospheric conditions. Each aura is a unique visualization that combines multiple weather parameters into a beautiful, dynamic display.

## Features

The aura visualization is influenced by:

- **Geographic Coordinates** (Latitude/Longitude): Affects the base color palette and rotation
- **Altitude**: Controls the size of the aura (higher altitude = larger aura)
- **Cloud Cover**: Affects opacity and blur (more clouds = more opaque and blurred)
- **Temperature**: Influences color gradient (cold = blue tones, hot = red/orange tones)
- **Air Quality**: Affects color saturation and hue (good = green, poor = red/brown)
- **Wind Speed**: Controls animation intensity and rotation (higher wind = faster, more dynamic)

## How to Use

1. Open `index.html` in a web browser
2. Adjust the sliders and inputs to change weather parameters
3. Watch the aura transform in real-time
4. Use "Generate Random Aura" to explore different combinations
5. Use "Reset to Default" to return to baseline values

## Technical Details

- Pure HTML, CSS, and JavaScript (no dependencies)
- Responsive design that works on desktop and mobile
- Real-time updates as you adjust parameters
- Smooth animations and transitions

## Parameter Ranges

- **Latitude**: -90 to 90 degrees
- **Longitude**: -180 to 180 degrees
- **Altitude**: 0 to 8,848 meters (sea level to Mount Everest)
- **Cloud Cover**: 0 to 100%
- **Temperature**: -40 to 50°C
- **Air Quality**: 0 to 500 AQI (Air Quality Index)
- **Wind Speed**: 0 to 200 km/h

Enjoy exploring the infinite variations of weather auras!

