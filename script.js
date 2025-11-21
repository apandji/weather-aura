// Weather Aura Generator
// Generates visual auras based on weather parameters with multiple modes

class WeatherAura {
    constructor() {
        this.currentMode = 'radial';
        // Additional weather data for enhanced variation
        this.weatherData = {
            humidity: 50,
            pressure: 1013,
            uvIndex: 5,
            visibility: 10,
            windDirection: 0,
            isDay: 1,
            weatherCode: 0
        };
        this.initializeElements();
        this.attachEventListeners();
        // Try to get user location and fetch weather, fallback to St. Louis
        this.initializeLocation();
    }

    initializeElements() {
        // Input elements
        this.locationSearch = document.getElementById('location-search');
        this.searchBtn = document.getElementById('search-btn');
        this.searchStatus = document.getElementById('search-status');
        this.latitude = document.getElementById('latitude');
        this.longitude = document.getElementById('longitude');
        this.altitude = document.getElementById('altitude');
        this.cloudCover = document.getElementById('cloudCover');
        this.temperature = document.getElementById('temperature');
        this.airQuality = document.getElementById('airQuality');
        this.windSpeed = document.getElementById('windSpeed');
        this.precipitation = document.getElementById('precipitation');
        
        // Display elements
        this.aura = document.getElementById('aura');
        this.locationDisplay = document.getElementById('location-display');
        this.tempDisplay = document.getElementById('temp-display');
        this.windDisplay = document.getElementById('wind-display');
        this.airDisplay = document.getElementById('air-display');
        this.inclementDisplay = document.getElementById('inclement-display');
        this.inclementItem = document.getElementById('inclement-item');
        this.inclementTooltip = document.getElementById('inclement-tooltip');
        
        // Store current inclement data for tooltip
        this.currentInclementData = null;
        
        // Value displays
        this.altitudeValue = document.getElementById('altitude-value');
        this.cloudCoverValue = document.getElementById('cloudCover-value');
        this.temperatureValue = document.getElementById('temperature-value');
        this.airQualityValue = document.getElementById('airQuality-value');
        this.windSpeedValue = document.getElementById('windSpeed-value');
        this.precipitationValue = document.getElementById('precipitation-value');
        
        // Buttons
        this.searchBtn = document.getElementById('search-btn');
        this.randomBtn = document.getElementById('random-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.modeButtons = document.querySelectorAll('.mode-btn');
    }

    attachEventListeners() {
        // Debounce timer for coordinate changes
        this.coordinateChangeTimer = null;
        
        // Update aura on any input change
        const inputs = [
            this.altitude,
            this.cloudCover, this.temperature, this.airQuality, this.windSpeed, this.precipitation
        ];
        
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateValueDisplays();
                this.updateAura();
            });
        });
        
        // Auto-fetch weather when coordinates change (with debouncing)
        [this.latitude, this.longitude].forEach(input => {
            input.addEventListener('input', () => {
                // Clear existing timer
                if (this.coordinateChangeTimer) {
                    clearTimeout(this.coordinateChangeTimer);
                }
                
                // Set new timer to fetch after user stops typing (1 second delay)
                this.coordinateChangeTimer = setTimeout(() => {
                    const lat = this.latitude.value;
                    const lon = this.longitude.value;
                    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                        this.fetchLiveWeather();
                    }
                }, 1000);
            });
        });

        // Location search
        this.searchBtn.addEventListener('click', () => this.searchLocation());
        this.locationSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchLocation();
        });
        
        // Random button
        this.randomBtn.addEventListener('click', () => this.randomize());
        
        // Refresh data button
        this.refreshBtn.addEventListener('click', () => this.fetchLiveWeather());

        // Mode selection and tooltips
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMode = btn.dataset.mode;
                this.updateAura();
            });
            
            // Add tooltip
            this.addModeTooltip(btn);
        });

        this.resetBtn.addEventListener('click', () => this.reset());
        
        // Inclement score tooltip hover
        if (this.inclementItem && this.inclementTooltip) {
            this.inclementItem.addEventListener('mouseenter', () => {
                if (this.currentInclementData) {
                    this.inclementTooltip.style.opacity = '1';
                    this.inclementTooltip.style.visibility = 'visible';
                }
            });
            
            this.inclementItem.addEventListener('mouseleave', () => {
                this.inclementTooltip.style.opacity = '0';
                this.inclementTooltip.style.visibility = 'hidden';
            });
        }
    }

    async initializeLocation() {
        // Try to get user's current location
        if (navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => {
                    // Set a timeout for geolocation (5 seconds)
                    const timeout = setTimeout(() => {
                        reject(new Error('Geolocation timeout'));
                    }, 5000);
                    
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            clearTimeout(timeout);
                            resolve(pos);
                        },
                        (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        }
                    );
                });

                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                this.latitude.value = lat.toFixed(4);
                this.longitude.value = lon.toFixed(4);
                
                // Get elevation
                try {
                    const elevResponse = await fetch(
                        `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
                    );
                    const elevData = await elevResponse.json();
                    if (elevData.elevation && elevData.elevation[0]) {
                        this.altitude.value = Math.round(elevData.elevation[0]);
                    }
                } catch (e) {
                    // If elevation fails, use default
                    this.altitude.value = 100;
                }
                
                // Reverse geocode to get location name
                await this.reverseGeocodeFromCoords(lat, lon);
                
                // Fetch live weather data
                await this.fetchLiveWeather(true); // silent mode
                
                this.updateValueDisplays();
                this.updateAura();
                return;
            } catch (error) {
                console.log('Geolocation failed, falling back to St. Louis:', error);
                // Fall through to St. Louis fallback
            }
        }
        
        // Fallback to St. Louis if geolocation fails or is not available
        await this.setStLouisLocation();
    }

    async setStLouisLocation() {
        // St. Louis coordinates
        const stLouisLat = 38.6270;
        const stLouisLon = -90.1994;
        
        this.latitude.value = stLouisLat.toFixed(4);
        this.longitude.value = stLouisLon.toFixed(4);
        
        // Get elevation for St. Louis
        try {
            const elevResponse = await fetch(
                `https://api.open-meteo.com/v1/elevation?latitude=${stLouisLat}&longitude=${stLouisLon}`
            );
            const elevData = await elevResponse.json();
            if (elevData.elevation && elevData.elevation[0]) {
                this.altitude.value = Math.round(elevData.elevation[0]);
            } else {
                this.altitude.value = 150; // Default elevation for St. Louis
            }
        } catch (e) {
            this.altitude.value = 150;
        }
        
        // Reverse geocode to get location name
        await this.reverseGeocodeFromCoords(stLouisLat, stLouisLon);
        
        // Fetch live weather data
        await this.fetchLiveWeather(true); // silent mode
        
        this.updateValueDisplays();
        this.updateAura();
    }

    async reverseGeocodeFromCoords(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
                {
                    headers: {
                        'User-Agent': 'WeatherAuraGenerator/1.0'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data) {
                const locationName = this.updateLocationDisplay(data.display_name || null, data);
                if (!locationName) {
                    // Fallback if extraction fails
                    if (data.display_name) {
                        this.locationDisplay.textContent = data.display_name.split(',')[0] || 'Location';
                    } else {
                        this.locationDisplay.textContent = 'Unknown Location';
                    }
                }
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            // Keep default location display
        }
    }

    async searchLocation() {
        const query = this.locationSearch.value.trim();
        if (!query) return;

        this.searchStatus.textContent = 'Searching...';
        this.searchStatus.className = 'search-status';

        try {
            // Use OpenStreetMap Nominatim API (free, no API key needed)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'WeatherAuraGenerator/1.0'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                this.latitude.value = parseFloat(result.lat).toFixed(4);
                this.longitude.value = parseFloat(result.lon).toFixed(4);
                
                // Try to get elevation (using Open-Meteo elevation API)
                try {
                    const elevResponse = await fetch(
                        `https://api.open-meteo.com/v1/elevation?latitude=${result.lat}&longitude=${result.lon}`
                    );
                    const elevData = await elevResponse.json();
                    if (elevData.elevation && elevData.elevation[0]) {
                        this.altitude.value = Math.round(elevData.elevation[0]);
                    }
                } catch (e) {
                    // If elevation fails, estimate based on location or use default
                    this.altitude.value = 100;
                }
                
                this.searchStatus.textContent = `Found: ${result.display_name}`;
                this.searchStatus.className = 'search-status success';
                // Update location display with a shorter name
                const locationName = this.updateLocationDisplay(result.display_name);
                if (!locationName) {
                    // Fallback if extraction fails
                    this.locationDisplay.textContent = result.display_name.split(',')[0] || 'Location';
                }
                this.updateValueDisplays();
                this.updateAura();
                
                // Automatically fetch live weather data after location is set
                await this.fetchLiveWeather();
            } else {
                this.searchStatus.textContent = 'Location not found';
                this.searchStatus.className = 'search-status error';
            }
        } catch (error) {
            this.searchStatus.textContent = 'Search failed. Please try again.';
            this.searchStatus.className = 'search-status error';
            console.error('Geocoding error:', error);
        }
    }

    async fetchLiveWeather(silent = false) {
        const lat = this.latitude.value;
        const lon = this.longitude.value;
        
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            if (!silent) {
                this.searchStatus.textContent = 'Please set coordinates first';
                this.searchStatus.className = 'search-status error';
            }
            return;
        }
        
        if (!silent) {
            this.searchStatus.textContent = 'Fetching live weather...';
            this.searchStatus.className = 'search-status';
            if (this.refreshBtn) {
                this.refreshBtn.disabled = true;
            }
        }
        
        try {
            // Fetch current weather from Open-Meteo (free, no API key)
            // Added: relative_humidity_2m, surface_pressure, uv_index, visibility, wind_direction_10m, is_day, weather_code
            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloud_cover,wind_speed_10m,precipitation,relative_humidity_2m,surface_pressure,uv_index,visibility,wind_direction_10m,is_day,weather_code&wind_speed_unit=kmh&precipitation_unit=mm`
            );
            
            const weatherData = await weatherResponse.json();
            
            if (weatherData && weatherData.current) {
                const current = weatherData.current;
                
                // Update temperature (convert from API format if needed)
                if (current.temperature_2m !== undefined) {
                    this.temperature.value = Math.round(current.temperature_2m);
                }
                
                // Update cloud cover
                if (current.cloud_cover !== undefined) {
                    this.cloudCover.value = Math.round(current.cloud_cover);
                }
                
                // Update wind speed
                if (current.wind_speed_10m !== undefined) {
                    this.windSpeed.value = Math.round(current.wind_speed_10m);
                }
                
                // Update precipitation
                if (current.precipitation !== undefined) {
                    this.precipitation.value = Math.max(0, current.precipitation).toFixed(1);
                }
                
                // Store additional weather data for enhanced variation
                if (current.relative_humidity_2m !== undefined) {
                    this.weatherData.humidity = current.relative_humidity_2m;
                }
                if (current.surface_pressure !== undefined) {
                    this.weatherData.pressure = current.surface_pressure;
                }
                if (current.uv_index !== undefined) {
                    this.weatherData.uvIndex = current.uv_index;
                }
                if (current.visibility !== undefined) {
                    this.weatherData.visibility = current.visibility;
                }
                if (current.wind_direction_10m !== undefined) {
                    this.weatherData.windDirection = current.wind_direction_10m;
                }
                if (current.is_day !== undefined) {
                    this.weatherData.isDay = current.is_day;
                }
                if (current.weather_code !== undefined) {
                    this.weatherData.weatherCode = current.weather_code;
                }
            }
            
            // Fetch air quality (separate endpoint)
            try {
                const aqiResponse = await fetch(
                    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`
                );
                
                const aqiData = await aqiResponse.json();
                
                if (aqiData && aqiData.current && aqiData.current.us_aqi !== undefined) {
                    this.airQuality.value = Math.round(aqiData.current.us_aqi);
                }
            } catch (aqiError) {
                console.warn('Air quality data not available:', aqiError);
                // Keep existing AQI value if fetch fails
            }
            
            if (!silent) {
                this.searchStatus.textContent = 'Live weather data loaded';
                this.searchStatus.className = 'search-status success';
            }
            this.updateValueDisplays();
            this.updateAura();
            
        } catch (error) {
            console.error('Weather fetch error:', error);
            if (!silent) {
                this.searchStatus.textContent = 'Failed to fetch weather data';
                this.searchStatus.className = 'search-status error';
            }
        } finally {
            if (this.refreshBtn) {
                this.refreshBtn.disabled = false;
            }
        }
    }

    updateValueDisplays() {
        this.altitudeValue.textContent = `${this.altitude.value} m`;
        this.cloudCoverValue.textContent = `${this.cloudCover.value}%`;
        this.temperatureValue.textContent = `${this.temperature.value}°C`;
        
        const aq = parseInt(this.airQuality.value);
        const aqLabel = this.getAirQualityLabel(aq);
        this.airQualityValue.textContent = `${aq} (${aqLabel})`;
        
        this.windSpeedValue.textContent = `${this.windSpeed.value} km/h`;
        
        const precip = parseFloat(this.precipitation.value);
        this.precipitationValue.textContent = `${precip.toFixed(1)} mm/h`;
        
        // Update info display
        this.tempDisplay.textContent = `${this.temperature.value}°C`;
        this.windDisplay.textContent = `${this.windSpeed.value} km/h`;
        this.airDisplay.textContent = this.getAirQualityLabel(aq);
        
        // Update inclement score display
        this.updateInclementDisplay();
    }
    
    updateInclementDisplay() {
        if (!this.inclementDisplay) return;
        
        if (!this.currentInclementData) {
            // Calculate current inclement data if not available
            const clouds = parseFloat(this.cloudCover.value);
            const wind = parseFloat(this.windSpeed.value);
            const precip = parseFloat(this.precipitation.value);
            this.currentInclementData = this.calculateInclementScore(
                this.weatherData, 
                wind, 
                precip, 
                clouds
            );
        }
        
        const score = this.currentInclementData.score;
        this.inclementDisplay.textContent = score.toFixed(2);
        
        // Update tooltip content
        this.updateInclementTooltip();
    }
    
    updateInclementTooltip() {
        if (!this.currentInclementData || !this.inclementTooltip) return;
        
        const { score, weatherType, factors } = this.currentInclementData;
        const tooltipContent = this.inclementTooltip.querySelector('.tooltip-content');
        
        if (!tooltipContent) return;
        
        // Format weather type name
        const weatherTypeNames = {
            'thunderstorm': 'Thunderstorm',
            'heavy_rain': 'Heavy Rain',
            'heavy_snow': 'Heavy Snow',
            'high_wind': 'High Wind',
            'showers': 'Showers',
            'light_precip': 'Light Precipitation',
            'fog': 'Fog',
            'normal': 'Normal'
        };
        
        let html = `<div class="tooltip-section">`;
        html += `<div class="tooltip-title">Weather Type:</div>`;
        html += `<div class="tooltip-value">${weatherTypeNames[weatherType] || weatherType}</div>`;
        html += `</div>`;
        
        html += `<div class="tooltip-section">`;
        html += `<div class="tooltip-title">Contributing Factors:</div>`;
        
        // Sort factors by contribution (value * weight)
        const sortedFactors = factors
            .map(f => ({
                ...f,
                contribution: f.value * f.weight
            }))
            .sort((a, b) => b.contribution - a.contribution)
            .filter(f => f.contribution > 0.01); // Only show factors with meaningful contribution
        
        sortedFactors.forEach(factor => {
            const percentage = (factor.contribution / score * 100).toFixed(0);
            const factorNames = {
                'weatherCode': 'Weather Code',
                'wind': 'Wind Speed',
                'precipitation': 'Precipitation',
                'visibility': 'Visibility',
                'cloudCover': 'Cloud Cover'
            };
            
            html += `<div class="tooltip-factor">`;
            html += `<span class="factor-name">${factorNames[factor.name] || factor.name}:</span>`;
            html += `<span class="factor-value">${(factor.value * 100).toFixed(0)}%</span>`;
            html += `<span class="factor-contribution">(${percentage}% of score)</span>`;
            html += `</div>`;
        });
        
        html += `</div>`;
        
        tooltipContent.innerHTML = html;
    }

    // Extract a shorter, more readable location name
    updateLocationDisplay(fullName, addressData = null) {
        // Try to build location name from address components if display_name is missing
        if (!fullName && addressData) {
            const address = addressData.address || {};
            let locationParts = [];
            
            // Try to get city/town/village
            if (address.city) locationParts.push(address.city);
            else if (address.town) locationParts.push(address.town);
            else if (address.village) locationParts.push(address.village);
            else if (address.municipality) locationParts.push(address.municipality);
            
            // Add state/region
            if (address.state) locationParts.push(address.state);
            else if (address.region) locationParts.push(address.region);
            
            // Add country if we don't have much else
            if (locationParts.length === 0 && address.country) {
                locationParts.push(address.country);
            }
            
            if (locationParts.length > 0) {
                fullName = locationParts.join(', ');
            }
        }
        
        if (!fullName) {
            // Last resort: show coordinates
            return null; // Return null to let caller handle with coordinates
        }
        
        // Split by comma and take the first part (usually city name)
        const parts = fullName.split(',');
        let locationName = parts[0].trim();
        
        // If we have a second part and it's short (likely state/country code), include it
        if (parts.length > 1) {
            const secondPart = parts[1].trim();
            // If second part is short (2-3 chars, likely a state code) or a common state name
            if (secondPart.length <= 3 || ['Missouri', 'Colorado', 'California', 'New York', 'Texas'].some(state => secondPart.includes(state))) {
                locationName = `${locationName}, ${secondPart}`;
            }
        }
        
        this.locationDisplay.textContent = locationName;
        return locationName;
    }

    getAirQualityLabel(aqi) {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy for Sensitive';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    }

    // Add tooltip to mode button explaining how data inputs affect the visualization
    addModeTooltip(button) {
        const mode = button.dataset.mode;
        const descriptions = {
            radial: {
                title: 'Radial Mode',
                effects: [
                    'Coordinates → Base color hue',
                    'Temperature → Color warmth/coolness',
                    'Air Quality → Color saturation',
                    'Wind Speed → Number of layers & spread',
                    'Wind Direction → Gradient center offset',
                    'Cloud Cover → Polygon shape (circle to polygon)',
                    'Precipitation → Rain streaks, droplets, wet gloss',
                    'Altitude → Brightness intensity',
                    'Humidity → Blur amount',
                    'UV Index → Overall brightness'
                ]
            },
            layered: {
                title: 'Layered Mode',
                effects: [
                    'Coordinates → Base color hue',
                    'Temperature → Color warmth/coolness',
                    'Air Quality → Color saturation',
                    'Wind Speed → Number of layers',
                    'Wind Direction → Linear gradient angles',
                    'Cloud Cover → Polygon shape',
                    'Precipitation → Rain streaks & water droplets',
                    'Pressure → Shadow spread',
                    'Altitude → Brightness intensity'
                ]
            },
            swirl: {
                title: 'Swirl Mode',
                effects: [
                    'Coordinates → Base color hue',
                    'Temperature → Color warmth/coolness',
                    'Air Quality → Color saturation',
                    'Wind Speed → Number of spiral layers',
                    'Wind Direction → Rotation angle',
                    'Cloud Cover → Polygon shape',
                    'Precipitation → Swirling rain particles',
                    'Altitude → Brightness intensity'
                ]
            },
            linear: {
                title: 'Linear Mode',
                effects: [
                    'Coordinates → Base color hue',
                    'Temperature → Color warmth/coolness',
                    'Air Quality → Color saturation',
                    'Wind Speed → Number of gradient layers',
                    'Wind Direction → Gradient angles',
                    'Cloud Cover → Polygon shape',
                    'Precipitation → Vertical rain streaks',
                    'UV Index → Brightness',
                    'Altitude → Brightness intensity'
                ]
            },
            particle: {
                title: 'Particle Mode',
                effects: [
                    'Coordinates → Base color hue',
                    'Temperature → Color warmth/coolness',
                    'Air Quality → Color saturation',
                    'Wind Speed → Particle count & spread',
                    'Wind Direction → Particle drift direction',
                    'Cloud Cover → Polygon shape',
                    'Precipitation → More particles & rain streaks',
                    'Humidity → Particle clustering',
                    'Altitude → Brightness intensity'
                ]
            },
            fractal: {
                title: 'Fractal Mode',
                effects: [
                    'Coordinates → Base color hue',
                    'Temperature → Color warmth/coolness',
                    'Air Quality → Color saturation',
                    'Wind Speed → Grid complexity',
                    'Wind Direction → Pattern angles',
                    'Cloud Cover → Polygon shape',
                    'Precipitation → Rain texture overlay',
                    'Weather Code → Contrast (clear vs foggy)',
                    'Altitude → Brightness intensity'
                ]
            },
            randomizer: {
                title: 'Randomizer Mode',
                effects: [
                    'Randomly selects one of the other modes',
                    'All data inputs affect the chosen mode',
                    'Each random generation uses a different mode',
                    'Great for exploring visual variation'
                ]
            }
        };

        const desc = descriptions[mode];
        if (!desc) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'mode-tooltip';
        
        const title = document.createElement('div');
        title.className = 'mode-tooltip-title';
        title.textContent = desc.title;
        tooltip.appendChild(title);
        
        const list = document.createElement('ul');
        list.className = 'mode-tooltip-list';
        desc.effects.forEach(effect => {
            const li = document.createElement('li');
            li.textContent = effect;
            list.appendChild(li);
        });
        tooltip.appendChild(list);
        
        button.appendChild(tooltip);
    }

    // Generate realistic temperature based on location
    generateRealisticTemperature(lat, alt) {
        const latitude = parseFloat(lat);
        const altitude = parseFloat(alt);
        
        // Check for catastrophic conditions (2% chance)
        const isCatastrophic = Math.random() < 0.02;
        
        if (isCatastrophic) {
            // Catastrophic: extreme heat or cold
            if (Math.random() < 0.5) {
                // Extreme heat: 45-50°C (heatwave conditions)
                return Math.round(45 + Math.random() * 5);
            } else {
                // Extreme cold: -45 to -50°C (life-threatening cold)
                return Math.round(-50 + Math.random() * 5);
            }
        }
        
        // Base temperature based on latitude (equator = warm, poles = cold)
        // At equator (0°): ~25-30°C average
        // At poles (±90°): ~-30 to -50°C average
        const latFactor = Math.abs(latitude) / 90; // 0 to 1
        const baseTemp = 28 - (latFactor * 78); // 28°C at equator, -50°C at poles
        
        // Altitude effect: -6.5°C per 1000m (standard lapse rate)
        const altitudeEffect = -(altitude / 1000) * 6.5;
        
        // Seasonal variation (simulate with some randomness)
        // More variation in temperate zones, less at extremes
        const seasonalVariation = (Math.random() - 0.5) * (20 - latFactor * 10); // ±10°C at equator, ±5°C at poles
        
        // Daily variation (more at lower latitudes)
        const dailyVariation = (Math.random() - 0.5) * (12 - latFactor * 4); // ±6°C at equator, ±4°C at poles
        
        // Desert effect: very hot days, cold nights (if low humidity area)
        const isDesert = Math.abs(latitude) < 30 && altitude < 1000 && Math.random() < 0.3;
        const desertEffect = isDesert ? (Math.random() < 0.5 ? 15 : -10) : 0; // Hot day or cold night
        
        const temp = baseTemp + altitudeEffect + seasonalVariation + dailyVariation + desertEffect;
        
        // Clamp to realistic range (-50 to 50°C)
        return Math.round(Math.max(-50, Math.min(50, temp)));
    }

    // Generate realistic wind speed based on location
    generateRealisticWindSpeed(lat, lon, alt) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        const altitude = parseFloat(alt);
        
        // Check for catastrophic conditions (1.5% chance)
        const isCatastrophic = Math.random() < 0.015;
        
        if (isCatastrophic) {
            // Catastrophic: hurricane or tornado-force winds
            if (Math.random() < 0.7) {
                // Hurricane: 120-200 km/h (74-124 mph)
                return Math.round(120 + Math.random() * 80);
            } else {
                // Extreme tornado: 200-250 km/h (124-155 mph) - rare but possible
                return Math.round(200 + Math.random() * 50);
            }
        }
        
        // Base wind speed: coastal areas and high altitudes tend to be windier
        let baseWind = 3 + Math.random() * 7; // 3-10 km/h base (calm to light breeze)
        
        // Check if coastal (rough approximation: near major coastlines)
        const isCoastal = Math.abs(latitude) < 60 && (
            Math.abs(longitude % 60) < 5 || // Rough coastal approximation
            altitude < 200 // Low altitude often means coastal
        );
        
        if (isCoastal) {
            baseWind += 8 + Math.random() * 20; // 8-28 km/h additional (breezy to moderate)
        }
        
        // High altitude = higher wind speeds (mountain winds)
        if (altitude > 2000) {
            baseWind += (altitude / 1000) * 8; // +8 km/h per 1000m above 2000m
        }
        
        // Polar regions can have strong katabatic winds
        if (Math.abs(latitude) > 70) {
            baseWind += 10 + Math.random() * 15; // 10-25 km/h additional
        }
        
        // Add some randomness (more variation in storm-prone areas)
        const variation = (Math.random() - 0.5) * (isCoastal ? 25 : 15);
        let windSpeed = baseWind + variation;
        
        // Rare strong wind events (5% chance of gale-force or higher)
        if (Math.random() < 0.05 && !isCatastrophic) {
            windSpeed = 60 + Math.random() * 60; // 60-120 km/h (gale to storm force)
        }
        
        // Clamp to realistic range (0-150 km/h for typical, up to 250 for catastrophic)
        return Math.round(Math.max(0, Math.min(250, windSpeed)));
    }

    // Generate realistic AQI based on location
    generateRealisticAQI(lat, lon, alt) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        const altitude = parseFloat(alt);
        
        // Check for catastrophic conditions (1% chance - pollution events are rare)
        const isCatastrophic = Math.random() < 0.01;
        
        if (isCatastrophic) {
            // Catastrophic: hazardous air quality (wildfire, industrial accident, etc.)
            return Math.round(300 + Math.random() * 200); // 300-500 AQI (hazardous to very hazardous)
        }
        
        // Base AQI: urban areas tend to have worse air quality
        // Simplified: check if coordinates suggest urban area (this is approximate)
        const isUrban = Math.abs(latitude) < 60 && Math.abs(longitude % 30) < 15;
        
        let baseAQI;
        
        if (isUrban) {
            // Urban areas: more variation
            // Good (0-50): 30% chance
            // Moderate (51-100): 40% chance
            // Unhealthy for Sensitive (101-150): 20% chance
            // Unhealthy (151-200): 8% chance
            // Very Unhealthy (201-300): 2% chance
            const roll = Math.random();
            if (roll < 0.30) {
                baseAQI = 20 + Math.random() * 30; // Good: 20-50
            } else if (roll < 0.70) {
                baseAQI = 50 + Math.random() * 50; // Moderate: 50-100
            } else if (roll < 0.90) {
                baseAQI = 100 + Math.random() * 50; // Unhealthy for Sensitive: 100-150
            } else if (roll < 0.98) {
                baseAQI = 150 + Math.random() * 50; // Unhealthy: 150-200
            } else {
                baseAQI = 200 + Math.random() * 100; // Very Unhealthy: 200-300
            }
        } else {
            // Rural/remote areas: generally better air quality
            // Good (0-50): 70% chance
            // Moderate (51-100): 25% chance
            // Unhealthy for Sensitive (101-150): 4% chance
            // Unhealthy (151-200): 1% chance
            const roll = Math.random();
            if (roll < 0.70) {
                baseAQI = 10 + Math.random() * 40; // Good: 10-50
            } else if (roll < 0.95) {
                baseAQI = 50 + Math.random() * 50; // Moderate: 50-100
            } else if (roll < 0.99) {
                baseAQI = 100 + Math.random() * 50; // Unhealthy for Sensitive: 100-150
            } else {
                baseAQI = 150 + Math.random() * 50; // Unhealthy: 150-200
            }
        }
        
        // High altitude = generally better air quality (less pollution)
        if (altitude > 1500) {
            baseAQI *= 0.6; // 40% reduction
        }
        
        // Very high altitude (mountains) = excellent air quality
        if (altitude > 3000) {
            baseAQI = Math.min(baseAQI, 30 + Math.random() * 20); // Cap at 30-50 (good)
        }
        
        // Add some variation (±15 AQI)
        const variation = (Math.random() - 0.5) * 30;
        const aqi = baseAQI + variation;
        
        // Clamp to realistic range (0-500 AQI)
        return Math.round(Math.max(0, Math.min(500, aqi)));
    }

    // Generate realistic precipitation based on cloud cover and location
    // Returns mm/hour (realistic range: 0-50mm/h, with 50mm/h being very heavy/extreme)
    generateRealisticPrecipitation(cloudCover, lat, alt) {
        const clouds = parseFloat(cloudCover);
        const latitude = parseFloat(lat);
        const altitude = parseFloat(alt);
        
        // Check for catastrophic conditions (1% chance - flash floods, extreme storms)
        const isCatastrophic = Math.random() < 0.01;
        
        if (isCatastrophic && clouds > 50) {
            // Catastrophic: extreme rainfall (flash flood conditions)
            return Math.min(50, 30 + Math.random() * 20); // 30-50mm/h (extreme)
        }
        
        // Precipitation is correlated with cloud cover
        // But not all clouds produce precipitation
        if (clouds < 30) {
            // Low cloud cover = unlikely precipitation
            return Math.random() < 0.1 ? Math.random() * 2.5 : 0; // 10% chance of light rain (0-2.5mm/h)
        } else if (clouds < 70) {
            // Moderate cloud cover = possible precipitation
            const hasPrecip = Math.random() < 0.4;
            if (!hasPrecip) return 0;
            
            // More variation: light to moderate
            const intensity = Math.random();
            if (intensity < 0.6) {
                return Math.random() * 2.5; // Light: 0-2.5mm/h
            } else {
                return 2.5 + Math.random() * 5.1; // Moderate: 2.5-7.6mm/h
            }
        } else {
            // High cloud cover = likely precipitation
            const intensity = Math.random();
            let basePrecip;
            
            if (intensity < 0.4) {
                // Light to moderate: 2.5-7.6mm/h
                basePrecip = 2.5 + Math.random() * 5.1;
            } else if (intensity < 0.85) {
                // Heavy: 7.6-25mm/h
                basePrecip = 7.6 + Math.random() * 17.4;
            } else {
                // Very heavy: 25-50mm/h
                basePrecip = 25 + Math.random() * 25;
            }
            
            // Tropical regions (near equator) get more intense rain
            if (Math.abs(latitude) < 20) {
                basePrecip *= (1.3 + Math.random() * 0.4); // 1.3-1.7x multiplier
            }
            
            // High altitude can increase precipitation (orographic effect)
            if (altitude > 1000) {
                basePrecip *= (1.1 + Math.random() * 0.3); // 1.1-1.4x multiplier
            }
            
            // Monsoon regions (tropical, seasonal) can have extreme rain
            if (Math.abs(latitude) < 25 && Math.random() < 0.1) {
                basePrecip *= 1.5; // 1.5x multiplier for monsoon conditions
            }
            
            return Math.min(50, basePrecip); // Cap at 50mm/h (very heavy/extreme)
        }
    }

    // Get base hue from coordinates
    getBaseHue(lat, lon) {
        const latNorm = ((parseFloat(lat) + 90) / 180) * 360;
        const lonNorm = ((parseFloat(lon) + 180) / 360) * 360;
        return (latNorm + lonNorm) % 360;
    }

    // Adjust hue for temperature (warm = shift toward red/orange, cool = shift toward blue)
    adjustTemperatureHue(baseHue, temp) {
        const normalized = (parseFloat(temp) + 40) / 90; // -40 to 50°C -> 0 to 1
        // Warm colors are around 0-60 (red/orange), cool colors are around 200-240 (blue)
        // Shift: 0 (cold) = +120 (toward blue), 1 (hot) = -60 (toward red)
        const shift = 120 - (normalized * 180);
        return (baseHue + shift) % 360;
    }

    // Get saturation based on air quality (lower AQI = higher saturation, higher AQI = lower saturation)
    getAirQualitySaturation(aqi) {
        const normalized = Math.min(aqi / 300, 1);
        // Good air (0-50 AQI) = high saturation (80-100%), bad air = low saturation (30-50%)
        return 80 - (normalized * 50);
    }

    // Get polygon sides from cloud cover
    // 0% = circle, 30% = triangle (3), 40% = diamond (4), 50% = pentagon (5), etc.
    getPolygonSides(cloudCover) {
        const clouds = parseFloat(cloudCover);
        
        if (clouds === 0) {
            return 999; // Circle (approximated with many sides)
        }
        
        if (clouds < 30) {
            // Interpolate from circle (999) to triangle (3) for 0-30%
            return Math.round(999 - ((clouds / 30) * 996));
        }
        
        // For 30% and above: 30% = 3, 40% = 4, 50% = 5, 60% = 6, ..., 100% = 10
        // Formula: sides = 3 + ((clouds - 30) / 10)
        return Math.round(3 + ((clouds - 30) / 10));
    }

    // Calculate inclement weather score (0-1 spectrum)
    // Combines multiple factors to create a gradual danger/aggressiveness score
    calculateInclementScore(weatherData, windSpeed, precipitation, cloudCover) {
        let score = 0;
        const factors = [];
        
        // Weather code severity (WMO codes)
        const weatherCode = weatherData?.weatherCode || 0;
        let weatherCodeScore = 0;
        let weatherType = 'normal';
        
        // Thunderstorms (most severe)
        if (weatherCode >= 95 && weatherCode <= 99) {
            weatherCodeScore = 0.9 + ((weatherCode - 95) / 4) * 0.1; // 0.9 to 1.0
            weatherType = 'thunderstorm';
        }
        // Heavy snow
        else if (weatherCode >= 71 && weatherCode <= 77) {
            weatherCodeScore = 0.6 + ((weatherCode - 71) / 6) * 0.2; // 0.6 to 0.8
            weatherType = 'heavy_snow';
        }
        // Heavy rain
        else if (weatherCode >= 61 && weatherCode <= 67) {
            weatherCodeScore = 0.5 + ((weatherCode - 61) / 6) * 0.2; // 0.5 to 0.7
            weatherType = 'heavy_rain';
        }
        // Showers (moderate)
        else if (weatherCode >= 80 && weatherCode <= 86) {
            weatherCodeScore = 0.3 + ((weatherCode - 80) / 6) * 0.2; // 0.3 to 0.5
            weatherType = 'showers';
        }
        // Light precipitation
        else if (weatherCode >= 51 && weatherCode <= 57) {
            weatherCodeScore = 0.15 + ((weatherCode - 51) / 6) * 0.1; // 0.15 to 0.25
            weatherType = 'light_precip';
        }
        // Fog (reduces visibility)
        else if (weatherCode >= 45 && weatherCode <= 49) {
            weatherCodeScore = 0.2;
            weatherType = 'fog';
        }
        
        factors.push({ name: 'weatherCode', value: weatherCodeScore, weight: 0.4 });
        
        // Wind speed contribution (0-1, normalized)
        // Moderate wind (30-50 km/h) = 0.3-0.5, Strong (50-80) = 0.5-0.7, Very strong (80+) = 0.7-1.0
        const wind = parseFloat(windSpeed) || 0;
        let windScore = 0;
        if (wind > 80) {
            windScore = 0.7 + Math.min(0.3, (wind - 80) / 100); // 0.7 to 1.0
        } else if (wind > 50) {
            windScore = 0.5 + ((wind - 50) / 30) * 0.2; // 0.5 to 0.7
        } else if (wind > 30) {
            windScore = 0.3 + ((wind - 30) / 20) * 0.2; // 0.3 to 0.5
        } else if (wind > 15) {
            windScore = 0.1 + ((wind - 15) / 15) * 0.2; // 0.1 to 0.3
        } else {
            windScore = wind / 15 * 0.1; // 0 to 0.1
        }
        
        // If high wind, override weather type
        if (windScore > 0.6 && weatherType === 'normal') {
            weatherType = 'high_wind';
        }
        factors.push({ name: 'wind', value: windScore, weight: 0.25 });
        
        // Precipitation intensity contribution
        const precip = parseFloat(precipitation) || 0;
        let precipScore = 0;
        if (precip > 10) {
            precipScore = 0.7 + Math.min(0.3, (precip - 10) / 20); // 0.7 to 1.0
        } else if (precip > 5) {
            precipScore = 0.5 + ((precip - 5) / 5) * 0.2; // 0.5 to 0.7
        } else if (precip > 2) {
            precipScore = 0.3 + ((precip - 2) / 3) * 0.2; // 0.3 to 0.5
        } else if (precip > 0.5) {
            precipScore = 0.1 + ((precip - 0.5) / 1.5) * 0.2; // 0.1 to 0.3
        } else {
            precipScore = precip / 0.5 * 0.1; // 0 to 0.1
        }
        factors.push({ name: 'precipitation', value: precipScore, weight: 0.2 });
        
        // Visibility contribution (low visibility = more dangerous)
        const visibility = weatherData?.visibility || 10;
        let visibilityScore = 0;
        if (visibility < 1) {
            visibilityScore = 0.5; // Very low visibility
        } else if (visibility < 3) {
            visibilityScore = 0.3;
        } else if (visibility < 5) {
            visibilityScore = 0.15;
        } else {
            visibilityScore = 0;
        }
        factors.push({ name: 'visibility', value: visibilityScore, weight: 0.1 });
        
        // Cloud cover contribution (very high cloud cover can indicate storms)
        const clouds = parseFloat(cloudCover) || 0;
        let cloudScore = 0;
        if (clouds > 90) {
            cloudScore = 0.2;
        } else if (clouds > 75) {
            cloudScore = 0.1;
        }
        factors.push({ name: 'cloudCover', value: cloudScore, weight: 0.05 });
        
        // Calculate weighted average
        let totalWeight = 0;
        factors.forEach(factor => {
            score += factor.value * factor.weight;
            totalWeight += factor.weight;
        });
        score = score / totalWeight; // Normalize
        
        // Ensure score is between 0 and 1
        score = Math.max(0, Math.min(1, score));
        
        return {
            score: score,
            weatherType: weatherType,
            factors: factors
        };
    }
    
    // Get star shape parameters based on weather type and inclement score
    getStarShapeParams(inclementData, baseSides) {
        const { score, weatherType } = inclementData;
        
        // Base number of points for the star
        let starPoints = baseSides;
        
        // Different spike patterns for different weather types
        let spikeIntensity = 0; // 0 = no spikes (regular polygon), 1 = maximum spikes
        let spikeSharpness = 0.3; // How sharp the spikes are (0.2 = soft, 0.5 = very sharp)
        let innerRadiusRatio = 0.5; // How far inward the spikes go (0.3 = deep spikes, 0.7 = shallow)
        
        if (score > 0.1) { // Start showing spikes even for mild inclement weather
            spikeIntensity = score; // Gradual transition
            
            switch (weatherType) {
                case 'thunderstorm':
                    // Sharp, aggressive spikes - many points, very sharp
                    starPoints = Math.max(8, Math.min(16, baseSides + Math.floor(score * 8)));
                    spikeSharpness = 0.4 + (score * 0.2); // 0.4 to 0.6
                    innerRadiusRatio = 0.3 + (score * 0.2); // 0.3 to 0.5 (deeper spikes)
                    break;
                    
                case 'heavy_rain':
                    // Medium spikes, more points
                    starPoints = Math.max(6, Math.min(12, baseSides + Math.floor(score * 6)));
                    spikeSharpness = 0.3 + (score * 0.15); // 0.3 to 0.45
                    innerRadiusRatio = 0.4 + (score * 0.2); // 0.4 to 0.6
                    break;
                    
                case 'heavy_snow':
                    // Softer, more numerous spikes (snowflake-like)
                    starPoints = Math.max(6, Math.min(12, baseSides + Math.floor(score * 6)));
                    spikeSharpness = 0.25 + (score * 0.1); // 0.25 to 0.35 (softer)
                    innerRadiusRatio = 0.45 + (score * 0.15); // 0.45 to 0.6
                    break;
                    
                case 'high_wind':
                    // Asymmetric, directional spikes
                    starPoints = Math.max(6, Math.min(10, baseSides + Math.floor(score * 4)));
                    spikeSharpness = 0.35 + (score * 0.15); // 0.35 to 0.5
                    innerRadiusRatio = 0.35 + (score * 0.2); // 0.35 to 0.55
                    break;
                    
                case 'showers':
                    // Gentle spikes
                    starPoints = Math.max(5, Math.min(8, baseSides + Math.floor(score * 3)));
                    spikeSharpness = 0.2 + (score * 0.1); // 0.2 to 0.3
                    innerRadiusRatio = 0.5 + (score * 0.15); // 0.5 to 0.65 (shallower)
                    break;
                    
                case 'light_precip':
                    // Very gentle spikes
                    starPoints = Math.max(4, Math.min(6, baseSides + Math.floor(score * 2)));
                    spikeSharpness = 0.2 + (score * 0.05); // 0.2 to 0.25
                    innerRadiusRatio = 0.55 + (score * 0.1); // 0.55 to 0.65
                    break;
                    
                case 'fog':
                    // Minimal spikes, more about shape distortion
                    starPoints = Math.max(3, Math.min(5, baseSides + Math.floor(score * 2)));
                    spikeSharpness = 0.15 + (score * 0.05); // 0.15 to 0.2
                    innerRadiusRatio = 0.6 + (score * 0.1); // 0.6 to 0.7
                    break;
                    
                default:
                    // Normal weather - gradual transition based on score
                    starPoints = Math.max(3, Math.min(8, baseSides + Math.floor(score * 5)));
                    spikeSharpness = 0.25 + (score * 0.15); // 0.25 to 0.4
                    innerRadiusRatio = 0.5 + (score * 0.2); // 0.5 to 0.7
            }
        }
        
        return {
            starPoints: starPoints,
            spikeIntensity: spikeIntensity,
            spikeSharpness: spikeSharpness,
            innerRadiusRatio: innerRadiusRatio
        };
    }
    
    // Generate star/spiky clip-path
    generateStarClipPath(starParams, size) {
        const { starPoints, spikeIntensity, spikeSharpness, innerRadiusRatio } = starParams;
        const points = [];
        
        // If no spikes, return regular polygon with smooth corners
        if (spikeIntensity <= 0) {
            // For very smooth shapes (low inclement score), use more points
            const smoothPoints = starPoints > 10 ? starPoints : Math.max(starPoints, 12);
            return this.generatePolygonClipPath(smoothPoints, size);
        }
        
        // Generate star shape with alternating outer and inner points
        for (let i = 0; i < starPoints; i++) {
            const angle = (i * 2 * Math.PI) / starPoints - Math.PI / 2; // Start from top
            
            // Outer point (spike tip)
            const outerRadius = 50; // Percentage from center
            const outerX = 50 + outerRadius * Math.cos(angle);
            const outerY = 50 + outerRadius * Math.sin(angle);
            points.push(`${outerX}% ${outerY}%`);
            
            // Inner point (between spikes) - position varies based on spike intensity
            const nextAngle = ((i + 1) * 2 * Math.PI) / starPoints - Math.PI / 2;
            const midAngle = (angle + nextAngle) / 2;
            
            // Interpolate inner radius based on spike intensity
            // Higher intensity = deeper spikes (lower inner radius)
            const innerRadius = outerRadius * (innerRadiusRatio + (1 - innerRadiusRatio) * (1 - spikeIntensity));
            
            // Apply sharpness: sharper spikes have inner points closer to the spike tips
            const sharpnessOffset = spikeSharpness * (outerRadius - innerRadius);
            const adjustedInnerRadius = innerRadius + sharpnessOffset;
            
            const innerX = 50 + adjustedInnerRadius * Math.cos(midAngle);
            const innerY = 50 + adjustedInnerRadius * Math.sin(midAngle);
            points.push(`${innerX}% ${innerY}%`);
        }
        
        return `polygon(${points.join(', ')})`;
    }

    // Generate polygon clip-path
    generatePolygonClipPath(sides, size) {
        const points = [];
        
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2; // Start from top
            const x = 50 + 50 * Math.cos(angle); // Percentage from center
            const y = 50 + 50 * Math.sin(angle);
            points.push(`${x}% ${y}%`);
        }
        
        return `polygon(${points.join(', ')})`;
    }
    
    // Generate shape clip-path (polygon or star based on inclement weather)
    generateShapeClipPath(cloudCover, weatherData, windSpeed, precipitation, size) {
        // Get base polygon sides from cloud cover
        const baseSides = this.getPolygonSides(cloudCover);
        
        // Calculate inclement weather score
        const inclementData = this.calculateInclementScore(weatherData, windSpeed, precipitation, cloudCover);
        
        // Store inclement data for display
        this.currentInclementData = inclementData;
        
        // Get star shape parameters
        const starParams = this.getStarShapeParams(inclementData, baseSides);
        
        // For very low scores, increase polygon points for smoother appearance
        if (inclementData.score < 0.2 && starParams.spikeIntensity <= 0) {
            starParams.starPoints = Math.max(starParams.starPoints, 16);
        }
        
        // Generate the appropriate shape
        const clipPath = this.generateStarClipPath(starParams, size);
        
        // Calculate border-radius based on inclement score
        // Low score (0) = smooth/round (50% = circle), High score (1) = sharp/angular (0%)
        // Note: border-radius works in combination with clip-path in some cases
        // For very smooth shapes (score < 0.1), use maximum border-radius
        const borderRadius = inclementData.score < 0.1 
            ? '50%' 
            : `${(1 - inclementData.score) * 50}%`;
        
        return {
            clipPath: clipPath,
            borderRadius: borderRadius
        };
    }

    // Get wind effect on gradient blending
    getWindGradientEffect(windSpeed) {
        const wind = parseFloat(windSpeed);
        // Higher wind = more chaotic gradient mixing
        // Returns: number of gradient layers, spread, and blend mode intensity
        return {
            layers: Math.max(2, Math.min(8, Math.floor(2 + wind / 25))),
            spread: Math.min(40, wind / 5), // How spread out the gradients are
            turbulence: wind / 100 // How chaotic the mixing is
        };
    }

    // Get altitude effect (intensity/brightness instead of size)
    getAltitudeEffect(altitude) {
        const alt = parseFloat(altitude);
        // Higher altitude = more intense/bright aura
        const intensity = 0.5 + (alt / 8848) * 0.5; // 0.5 to 1.0
        return intensity;
    }

    // Get precipitation visual effects
    getPrecipitationEffect(precipitation, temperature) {
        const precip = parseFloat(precipitation);
        const temp = parseFloat(temperature);
        
        // Determine if it's snow (temp < 0°C) or rain
        const isSnow = temp < 0;
        const intensity = Math.min(1, precip / 50);
        
        return {
            intensity: intensity, // 0-1 based on precipitation amount
            blur: precip / 10, // More precipitation = more blur (like looking through rain)
            desaturation: precip / 100, // Rain desaturates colors
            streakCount: Math.floor(precip / 5), // Number of rain/snow streaks
            isSnow: isSnow,
            verticalShift: precip / 20, // Rain falls down, creates vertical emphasis
            particleDensity: precip / 2, // More precipitation = more particles
            dropletCount: Math.floor(precip / 3), // Water droplets/beads on surface
            glossIntensity: intensity * 0.6, // Glossy/wet surface effect
            highlightCount: Math.floor(precip / 4) // Reflective highlights
        };
    }

    // MODE 1: Radial - Classic radial gradients with shadows
    generateRadialAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const numLayers = windEffect.layers;
        
        for (let i = 0; i < numLayers; i++) {
            const angle = (i * 360 / numLayers) + (windEffect.turbulence * i * 30);
            const offsetX = 50 + Math.sin(angle * Math.PI / 180) * windEffect.spread;
            const offsetY = 50 + Math.cos(angle * Math.PI / 180) * windEffect.spread;
            const hue = (tempHue + i * 20) % 360;
            const lightness = 40 + (i % 2) * 20;
            
            gradients.push(
                `radial-gradient(circle at ${offsetX}% ${offsetY}%, 
                    hsl(${hue}, ${saturation}%, ${lightness}%) 0%, 
                    transparent ${60 + windEffect.turbulence * 20}%)`
            );
        }
        
        // Add shadow based on altitude and wind
        const shadowOffset = Math.min(20, windEffect.turbulence * 15);
        const shadowBlur = 30 + altitudeIntensity * 20;
        const shadowColor = `hsla(${tempHue}, ${saturation}%, 20%, ${0.3 + altitudeIntensity * 0.2})`;
        
        // Enhanced effects from additional weather data
        const humidityBlur = (weatherData?.humidity || 50) / 100 * 3; // High humidity = more blur
        const uvBrightness = 1 + ((weatherData?.uvIndex || 5) / 11) * 0.3; // UV affects brightness
        const visibilityOpacity = Math.min(1, (weatherData?.visibility || 10) / 10); // Visibility affects opacity
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.7; // Night is darker
        
        // Wind direction affects radial gradient center position (wind pushes the aura)
        const windDir = weatherData?.windDirection || 0;
        const windRadians = (windDir * Math.PI) / 180;
        const windOffset = windEffect.turbulence * 10; // Offset based on wind speed
        const centerX = 50 + Math.cos(windRadians) * windOffset;
        const centerY = 50 + Math.sin(windRadians) * windOffset;
        
        // Adjust radial gradients to use wind-influenced center
        const adjustedGradients = gradients.map(grad => {
            // If it's a radial gradient, adjust the center position
            if (grad.includes('radial-gradient')) {
                return grad.replace(/at 50% 50%/, `at ${centerX}% ${centerY}%`);
            }
            return grad;
        });
        
        // Precipitation effects: add rain/snow streaks and blur
        const totalBlur = humidityBlur + precipEffect.blur;
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        
        // Add rain/snow streaks angled by wind direction - make them look more like actual rain
        if (precipEffect.intensity > 0.1) {
            const streakColor = precipEffect.isSnow ? 
                `hsla(${tempHue}, ${adjustedSaturation}%, 90%, ${precipEffect.intensity * 0.4})` :
                `hsla(${tempHue}, ${adjustedSaturation}%, 70%, ${precipEffect.intensity * 0.5})`;
            
            // Rain falls down but is angled by wind (wind direction + 90° for vertical with wind tilt)
            const rainAngle = (windDir + 90) % 360; // Vertical (down) but tilted by wind
            
            // Create more pronounced rain streaks
            for (let i = 0; i < precipEffect.streakCount; i++) {
                const x = (i * (100 / Math.max(1, precipEffect.streakCount))) + (Math.random() * 10 - 5);
                const streakLength = 15 + Math.random() * 20; // Variable length streaks
                const streakStart = Math.max(0, x - streakLength / 2);
                const streakEnd = Math.min(100, x + streakLength / 2);
                
                adjustedGradients.push(
                    `linear-gradient(${rainAngle}deg, 
                        transparent ${streakStart}%, 
                        ${streakColor} ${x - 1}%, 
                        ${streakColor} ${x}%, 
                        ${streakColor} ${x + 1}%, 
                        transparent ${streakEnd}%)`
                );
            }
            
            // Add water droplets/beads - small circular highlights that look like water on surface
            for (let i = 0; i < precipEffect.dropletCount; i++) {
                const dropletX = 10 + Math.random() * 80;
                const dropletY = 10 + Math.random() * 80;
                const dropletSize = 1 + Math.random() * 2;
                const highlightColor = `hsla(${tempHue}, ${adjustedSaturation}%, 95%, ${precipEffect.intensity * 0.6})`;
                
                // Water droplet with highlight
                adjustedGradients.push(
                    `radial-gradient(circle at ${dropletX}% ${dropletY}%, 
                        ${highlightColor} 0%, 
                        ${highlightColor} ${dropletSize * 0.3}%, 
                        hsla(${tempHue}, ${adjustedSaturation}%, 80%, ${precipEffect.intensity * 0.3}) ${dropletSize * 0.6}%,
                        transparent ${dropletSize}%)`
                );
            }
            
            // Add glossy highlights - like wet surface reflections
            for (let i = 0; i < precipEffect.highlightCount; i++) {
                const highlightX = Math.random() * 100;
                const highlightY = Math.random() * 100;
                const highlightSize = 5 + Math.random() * 10;
                const highlightAngle = (windDir + 45) % 360; // Highlights follow light direction
                
                adjustedGradients.push(
                    `linear-gradient(${highlightAngle}deg, 
                        transparent ${highlightY - highlightSize}%, 
                        hsla(${tempHue}, ${adjustedSaturation}%, 90%, ${precipEffect.glossIntensity * 0.4}) ${highlightY}%, 
                        transparent ${highlightY + highlightSize}%)`
                );
            }
        }
        
        // Add glossy/wet surface effect using filter
        const wetGloss = precipEffect.intensity > 0.1 ? `contrast(${1 + precipEffect.glossIntensity * 0.2}) brightness(${1 + precipEffect.glossIntensity * 0.1})` : '';
        
        const shapeData = this.generateShapeClipPath(clouds, weatherData, wind, precip, size);
        return {
            background: adjustedGradients.join(', '),
            clipPath: shapeData.clipPath,
            borderRadius: shapeData.borderRadius,
            filter: `brightness(${altitudeIntensity * uvBrightness * dayNightBrightness}) blur(${totalBlur}px) saturate(${100 - (precipEffect.desaturation * 50)}%) ${wetGloss}`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size,
            opacity: visibilityOpacity
        };
    }

    // MODE 2: Layered - Stacked concentric layers with linear gradients
    generateLayeredAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const numLayers = windEffect.layers;
        
        // Use wind direction for gradient angles
        const windDir = weatherData?.windDirection || 0;
        const useLinear = windEffect.turbulence > 0.5;
        // Base gradient angle follows wind direction
        const baseGradientAngle = windDir;
        
        for (let i = 0; i < numLayers; i++) {
            const progress = i / (numLayers - 1);
            const hue = (tempHue + progress * 60) % 360;
            
            if (useLinear && i % 2 === 0) {
                // Linear gradient angled by wind direction, with variation per layer
                const layerAngle = (baseGradientAngle + (i * 30)) % 360;
                gradients.push(
                    `linear-gradient(${layerAngle}deg, 
                        hsla(${hue}, ${saturation}%, ${50 + progress * 20}%, ${0.8 - progress * 0.3}) 0%, 
                        transparent ${50 + windEffect.spread}%)`
                );
            } else {
                // Radial gradient with center offset by wind direction
                const windRadians = (windDir * Math.PI) / 180;
                const windOffset = windEffect.turbulence * 8;
                const centerX = 50 + Math.cos(windRadians) * windOffset * progress;
                const centerY = 50 + Math.sin(windRadians) * windOffset * progress;
                
                const startRadius = progress * 30;
                const endRadius = startRadius + 20 + windEffect.spread;
                gradients.push(
                    `radial-gradient(circle at ${centerX}% ${centerY}%, 
                        hsla(${hue}, ${saturation}%, ${50 + progress * 20}%, ${0.8 - progress * 0.3}) ${startRadius}%, 
                        transparent ${endRadius}%)`
                );
            }
        }
        
        const shadowOffset = 15;
        const shadowBlur = 40;
        const shadowColor = `hsla(${tempHue}, ${saturation}%, 15%, ${0.4 * altitudeIntensity})`;
        
        // Pressure affects density - lower pressure = more spread out
        const pressureEffect = weatherData?.pressure ? (1013 - weatherData.pressure) / 50 : 0;
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.75;
        
        // Precipitation adds streaks angled by wind direction - enhanced wet effects
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            const streakColor = precipEffect.isSnow ? 
                `hsla(${tempHue}, ${adjustedSaturation}%, 85%, ${precipEffect.intensity * 0.35})` :
                `hsla(${tempHue}, ${adjustedSaturation}%, 65%, ${precipEffect.intensity * 0.45})`;
            
            // Rain falls down but is angled by wind (wind direction + 90° for vertical with wind tilt)
            const rainAngle = (windDir + 90) % 360;
            
            // More pronounced rain streaks with variable length
            for (let i = 0; i < precipEffect.streakCount; i++) {
                const x = 10 + (i * (80 / Math.max(1, precipEffect.streakCount)));
                const streakLength = 10 + Math.random() * 15;
                gradients.push(
                    `linear-gradient(${rainAngle}deg, 
                        transparent ${x - streakLength}%, 
                        ${streakColor} ${x}%, 
                        ${streakColor} ${x + 1}%, 
                        transparent ${x + streakLength}%)`
                );
            }
            
            // Add water droplets
            for (let i = 0; i < precipEffect.dropletCount; i++) {
                const dropletX = 10 + Math.random() * 80;
                const dropletY = 10 + Math.random() * 80;
                const dropletSize = 1 + Math.random() * 2;
                const highlightColor = `hsla(${tempHue}, ${adjustedSaturation}%, 95%, ${precipEffect.intensity * 0.5})`;
                
                gradients.push(
                    `radial-gradient(circle at ${dropletX}% ${dropletY}%, 
                        ${highlightColor} 0%, 
                        ${highlightColor} ${dropletSize * 0.3}%, 
                        hsla(${tempHue}, ${adjustedSaturation}%, 80%, ${precipEffect.intensity * 0.25}) ${dropletSize * 0.6}%,
                        transparent ${dropletSize}%)`
                );
            }
        }
        
        // Add glossy/wet surface effect
        const wetGloss = precipEffect.intensity > 0.1 ? `contrast(${1 + precipEffect.glossIntensity * 0.2}) brightness(${1 + precipEffect.glossIntensity * 0.1})` : '';
        
        const shapeData = this.generateShapeClipPath(clouds, weatherData, wind, precip, size);
        return {
            background: gradients.join(', '),
            clipPath: shapeData.clipPath,
            borderRadius: shapeData.borderRadius,
            filter: `brightness(${altitudeIntensity * dayNightBrightness}) blur(${precipEffect.blur}px) saturate(${100 - (precipEffect.desaturation * 50)}%) ${wetGloss}`,
            boxShadow: `${shadowOffset + pressureEffect}px ${shadowOffset + pressureEffect}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    // MODE 3: Swirl - Smooth, flowing spiral/whirlpool with large continuous gradients
    generateSwirlAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        
        // Use wind direction for rotation (more realistic)
        const windRotation = weatherData?.windDirection ? weatherData.windDirection : windEffect.turbulence * 45;
        
        // Create a smooth, continuous spiral using large radial gradients that spiral outward
        // This creates a flowing, organic whirlpool effect
        const numSpirals = Math.max(4, windEffect.layers * 2);
        for (let i = 0; i < numSpirals; i++) {
            const progress = i / numSpirals;
            // Spiral outward from center
            const spiralAngle = (windRotation + progress * 720) % 360; // 2 full rotations
            const spiralRadius = progress * 40; // Spiral from center outward
            const centerX = 50 + Math.cos(spiralAngle * Math.PI / 180) * spiralRadius;
            const centerY = 50 + Math.sin(spiralAngle * Math.PI / 180) * spiralRadius;
            
            const hue = (tempHue + i * 25) % 360;
            const lightness = 45 + (i % 3) * 20;
            const gradientSize = 30 + (1 - progress) * 25; // Larger near center, smaller at edges
            
            // Large, smooth radial gradients that create flowing spiral
            gradients.push(
                `radial-gradient(circle at ${centerX}% ${centerY}%, 
                    hsla(${hue}, ${saturation}%, ${lightness}%, ${0.7 - progress * 0.4}) 0%, 
                    hsla(${hue}, ${saturation}%, ${lightness - 10}%, ${0.5 - progress * 0.3}) ${gradientSize * 0.4}%,
                    transparent ${gradientSize}%)`
            );
        }
        
        // Add one large conic gradient for the base spiral flow
        gradients.push(
            `conic-gradient(from ${windRotation}deg at 50% 50%, 
                hsl(${tempHue}, ${saturation}%, 55%) 0deg,
                hsl(${(tempHue + 40) % 360}, ${saturation}%, 50%) 120deg,
                hsl(${(tempHue + 80) % 360}, ${saturation}%, 45%) 240deg,
                hsl(${tempHue}, ${saturation}%, 55%) 360deg)`
        );
        
        const shadowOffset = Math.min(25, windEffect.turbulence * 20);
        const shadowBlur = 50;
        const shadowColor = `hsla(${tempHue}, ${saturation}%, 10%, ${0.5 * altitudeIntensity})`;
        
        // windRotation already defined above
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.7;
        
        // Precipitation adds swirling rain/snow particles
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            for (let i = 0; i < precipEffect.streakCount * 2; i++) {
                const angle = (i * 360 / (precipEffect.streakCount * 2)) + windRotation;
                const radius = 30 + (i % 3) * 10;
                const x = 50 + Math.cos(angle * Math.PI / 180) * radius;
                const y = 50 + Math.sin(angle * Math.PI / 180) * radius;
                const streakColor = precipEffect.isSnow ? 
                    `hsla(${tempHue}, ${adjustedSaturation}%, 90%, ${precipEffect.intensity * 0.2})` :
                    `hsla(${tempHue}, ${adjustedSaturation}%, 60%, ${precipEffect.intensity * 0.3})`;
                
                gradients.push(
                    `radial-gradient(ellipse 20deg at ${x}% ${y}%, 
                        ${streakColor} 0%, 
                        transparent 15%)`
                );
            }
        }
        
        const shapeData = this.generateShapeClipPath(clouds, weatherData, wind, precip, size);
        return {
            background: gradients.join(', '),
            clipPath: shapeData.clipPath,
            borderRadius: shapeData.borderRadius,
            filter: `brightness(${altitudeIntensity * dayNightBrightness}) blur(${windEffect.turbulence * 2 + precipEffect.blur}px) saturate(${100 - (precipEffect.desaturation * 50)}%)`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size,
            transform: `rotate(${windRotation}deg)`
        };
    }

    // MODE 4: Linear - Top-to-bottom and diagonal linear gradients
    generateLinearAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const numLayers = windEffect.layers;
        
        // Create linear gradients with varying directions
        for (let i = 0; i < numLayers; i++) {
            const progress = i / (numLayers - 1);
            const hue = (tempHue + progress * 80) % 360;
            const lightness = 40 + progress * 30;
            
            // Vary gradient angle based on wind direction, wind turbulence, and layer
            const windDir = weatherData?.windDirection || 0;
            const baseAngle = windDir + (windEffect.turbulence * 180);
            const angle = baseAngle + (i * 45);
            
            // Create linear gradient
            gradients.push(
                `linear-gradient(${angle}deg, 
                    hsla(${hue}, ${saturation}%, ${lightness}%, ${0.9 - progress * 0.4}) 0%, 
                    hsla(${(hue + 40) % 360}, ${saturation}%, ${lightness - 10}%, ${0.7 - progress * 0.3}) 50%,
                    transparent 100%)`
            );
        }
        
        const shadowOffset = 20;
        const shadowBlur = 45;
        const shadowColor = `hsla(${tempHue}, ${saturation}%, 20%, ${0.4 * altitudeIntensity})`;
        
        // Use wind direction to influence gradient angles
        const windDir = weatherData?.windDirection || 0;
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.75;
        const uvBrightness = 1 + ((weatherData?.uvIndex || 5) / 11) * 0.2;
        
        // Precipitation creates streaks angled by wind direction - enhanced wet effects
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            // Rain falls down but is angled by wind (wind direction + 90° for vertical with wind tilt)
            const rainAngle = (windDir + 90) % 360;
            
            // Add more pronounced rain streaks
            for (let i = 0; i < precipEffect.streakCount * 2; i++) {
                const x = 5 + (i * (90 / Math.max(1, precipEffect.streakCount * 2)));
                const streakWidth = precipEffect.isSnow ? 2 : 1.5;
                const streakColor = precipEffect.isSnow ? 
                    `hsla(${tempHue}, ${adjustedSaturation}%, 90%, ${precipEffect.intensity * 0.5})` :
                    `hsla(${tempHue}, ${adjustedSaturation}%, 60%, ${precipEffect.intensity * 0.6})`;
                
                gradients.push(
                    `linear-gradient(${rainAngle}deg, 
                        ${streakColor} 0%, 
                        ${streakColor} ${50 - precipEffect.verticalShift}%, 
                        transparent ${50 + precipEffect.verticalShift}%)`
                );
            }
            
            // Add water droplets for wet effect
            for (let i = 0; i < precipEffect.dropletCount; i++) {
                const dropletX = 10 + Math.random() * 80;
                const dropletY = 10 + Math.random() * 80;
                const dropletSize = 1 + Math.random() * 2;
                const highlightColor = `hsla(${tempHue}, ${adjustedSaturation}%, 95%, ${precipEffect.intensity * 0.5})`;
                
                gradients.push(
                    `radial-gradient(circle at ${dropletX}% ${dropletY}%, 
                        ${highlightColor} 0%, 
                        ${highlightColor} ${dropletSize * 0.3}%, 
                        hsla(${tempHue}, ${adjustedSaturation}%, 80%, ${precipEffect.intensity * 0.25}) ${dropletSize * 0.6}%,
                        transparent ${dropletSize}%)`
                );
            }
        }
        
        // Add glossy/wet surface effect
        const wetGloss = precipEffect.intensity > 0.1 ? `contrast(${1 + precipEffect.glossIntensity * 0.2}) brightness(${1 + precipEffect.glossIntensity * 0.1})` : '';
        
        const shapeData = this.generateShapeClipPath(clouds, weatherData, wind, precip, size);
        return {
            background: gradients.join(', '),
            clipPath: shapeData.clipPath,
            borderRadius: shapeData.borderRadius,
            filter: `brightness(${altitudeIntensity * uvBrightness * dayNightBrightness}) blur(${precipEffect.blur}px) saturate(${100 - (precipEffect.desaturation * 50)}%) ${wetGloss}`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    // MODE 5: Particle - Scattered pointillist effect with many small gradients
    generateParticleAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        // Wind direction affects particle distribution (particles drift in wind direction)
        const windDir = weatherData?.windDirection || 0;
        const windRadians = (windDir * Math.PI) / 180;
        const windDrift = windEffect.turbulence * 15; // How much particles drift in wind direction
        
        // Particle density based on wind and precipitation (more wind/precip = more particles)
        const baseParticleCount = 50 + windEffect.turbulence * 100;
        const particleCount = Math.max(30, Math.min(200, baseParticleCount + precipEffect.particleDensity));
        const spreadRange = 20 + windEffect.spread * 2; // How far particles can be from center
        
        for (let i = 0; i < particleCount; i++) {
            // Random position with some clustering toward center, but biased by wind direction
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * spreadRange;
            // Add wind drift: particles are pushed in wind direction
            const windBias = (Math.random() - 0.5) * windDrift;
            const x = 50 + Math.cos(angle) * distance + Math.cos(windRadians) * windBias;
            const y = 50 + Math.sin(angle) * distance + Math.sin(windRadians) * windBias;
            
            // Hue variation based on temperature and position
            const hueVariation = (i * 15 + tempHue + windEffect.turbulence * 60) % 360;
            const hue = hueVariation;
            
            // Lightness varies for depth
            const lightness = 30 + (i % 4) * 20;
            
            // Particle size varies (smaller particles = more detail)
            const particleSize = 3 + Math.random() * 8 + windEffect.turbulence * 5;
            
            // Opacity varies for layering effect
            const opacity = 0.4 + Math.random() * 0.4;
            
            gradients.push(
                `radial-gradient(circle at ${x}% ${y}%, 
                    hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity}) 0%, 
                    hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.5}) ${particleSize * 0.3}%,
                    transparent ${particleSize}%)`
            );
        }
        
        const shadowOffset = 8;
        const shadowBlur = 25;
        const shadowColor = `hsla(${tempHue}, ${saturation}%, 20%, ${0.2 * altitudeIntensity})`;
        
        // Humidity affects particle spread (high humidity = more clustering)
        const humiditySpread = weatherData?.humidity ? (100 - weatherData.humidity) / 50 : 1;
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.8;
        
        // Precipitation adds more particles and streaks angled by wind direction
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            // Rain falls down but is angled by wind (wind direction + 90° for vertical with wind tilt)
            const rainAngle = (windDir + 90) % 360;
            
            // Add rain/snow streaks as additional particles, angled by wind
            for (let i = 0; i < precipEffect.streakCount; i++) {
                const x = 10 + Math.random() * 80;
                const y = 10 + Math.random() * 80;
                const streakLength = precipEffect.isSnow ? 15 : 10;
                const streakColor = precipEffect.isSnow ? 
                    `hsla(${tempHue}, ${adjustedSaturation}%, 90%, ${precipEffect.intensity * 0.3})` :
                    `hsla(${tempHue}, ${adjustedSaturation}%, 50%, ${precipEffect.intensity * 0.4})`;
                
                gradients.push(
                    `linear-gradient(${rainAngle}deg, 
                        transparent ${y - streakLength}%, 
                        ${streakColor} ${y}%, 
                        transparent ${y + streakLength}%)`
                );
            }
        }
        
        const shapeData = this.generateShapeClipPath(clouds, weatherData, wind, precip, size);
        return {
            background: gradients.join(', '),
            clipPath: shapeData.clipPath,
            borderRadius: shapeData.borderRadius,
            filter: `brightness(${altitudeIntensity * dayNightBrightness}) blur(${precipEffect.blur * 0.5}px) saturate(${100 - (precipEffect.desaturation * 50)}%)`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    // MODE 6: Fractal - Recursive geometric patterns with clear structure
    generateFractalAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const gridSize = Math.max(6, Math.floor(windEffect.layers * 1.5));
        
        // Use wind direction for gradient angles
        const windDir = weatherData?.windDirection || 0;
        
        // Create a clear geometric grid with distinct shapes - like a tessellation
        // Each cell has a clear geometric pattern
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const cellX = (i / gridSize) * 100;
                const cellY = (j / gridSize) * 100;
                const cellSize = 100 / gridSize;
                const cellCenterX = cellX + cellSize / 2;
                const cellCenterY = cellY + cellSize / 2;
                
                const hue = (tempHue + (i + j) * 25 + windEffect.turbulence * 40) % 360;
                const lightness = 40 + ((i + j) % 3) * 25;
                
                // Create distinct geometric shapes in each cell
                const shapeType = (i * gridSize + j) % 3;
                
                if (shapeType === 0) {
                    // Square/diamond pattern - use linear gradients to create geometric shapes
                    const angle = (windDir + (i + j) * 30) % 360;
                    const size = cellSize * 0.6;
                    gradients.push(
                        `linear-gradient(${angle}deg, 
                            transparent ${cellCenterX - size/2}%, 
                            hsla(${hue}, ${saturation}%, ${lightness}%, 0.8) ${cellCenterX}%, 
                            transparent ${cellCenterX + size/2}%)`
                    );
                    gradients.push(
                        `linear-gradient(${(angle + 90) % 360}deg, 
                            transparent ${cellCenterY - size/2}%, 
                            hsla(${hue}, ${saturation}%, ${lightness}%, 0.8) ${cellCenterY}%, 
                            transparent ${cellCenterY + size/2}%)`
                    );
                } else if (shapeType === 1) {
                    // Concentric circles - clear radial pattern
                    const numRings = 2;
                    for (let ring = 0; ring < numRings; ring++) {
                        const ringSize = (cellSize * 0.4) / numRings * (ring + 1);
                        gradients.push(
                            `radial-gradient(circle at ${cellCenterX}% ${cellCenterY}%, 
                                transparent ${ringSize * 0.7}%, 
                                hsla(${hue}, ${saturation}%, ${lightness}%, 0.6) ${ringSize * 0.7}%, 
                                hsla(${hue}, ${saturation}%, ${lightness}%, 0.3) ${ringSize}%, 
                                transparent ${ringSize * 1.2}%)`
                        );
                    }
                } else {
                    // Cross pattern - clear geometric lines
                    const lineWidth = cellSize * 0.15;
                    gradients.push(
                        `linear-gradient(${windDir}deg, 
                            transparent ${cellCenterX - lineWidth}%, 
                            hsla(${hue}, ${saturation}%, ${lightness}%, 0.7) ${cellCenterX}%, 
                            transparent ${cellCenterX + lineWidth}%)`
                    );
                    gradients.push(
                        `linear-gradient(${(windDir + 90) % 360}deg, 
                            transparent ${cellCenterY - lineWidth}%, 
                            hsla(${hue}, ${saturation}%, ${lightness}%, 0.7) ${cellCenterY}%, 
                            transparent ${cellCenterY + lineWidth}%)`
                    );
                }
            }
        }
        
        const shadowOffset = 10;
        const shadowBlur = 35;
        const shadowColor = `hsla(${tempHue}, ${saturation}%, 25%, ${0.3 * altitudeIntensity})`;
        
        // Weather code affects contrast (clear = high contrast, foggy = low contrast)
        const weatherCode = weatherData?.weatherCode || 0;
        const isClear = weatherCode === 0 || weatherCode === 1;
        const isFoggy = weatherCode >= 45 && weatherCode <= 49;
        const contrastModifier = isClear ? 1.2 : (isFoggy ? 0.8 : 1);
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.7;
        
        // Precipitation adds texture and patterns angled by wind direction
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            // Rain falls down but is angled by wind (wind direction + 90° for vertical with wind tilt)
            const rainAngle = (windDir + 90) % 360;
            
            // Add precipitation texture overlay, angled by wind
            for (let i = 0; i < precipEffect.streakCount; i++) {
                const x = Math.random() * 100;
                const y = Math.random() * 100;
                const streakColor = precipEffect.isSnow ? 
                    `hsla(${tempHue}, ${adjustedSaturation}%, 90%, ${precipEffect.intensity * 0.2})` :
                    `hsla(${tempHue}, ${adjustedSaturation}%, 50%, ${precipEffect.intensity * 0.3})`;
                
                gradients.push(
                    `linear-gradient(${rainAngle}deg, 
                        transparent ${y - 5}%, 
                        ${streakColor} ${y}%, 
                        transparent ${y + 5}%)`
                );
            }
        }
        
        const shapeData = this.generateShapeClipPath(clouds, weatherData, wind, precip, size);
        return {
            background: gradients.join(', '),
            clipPath: shapeData.clipPath,
            borderRadius: shapeData.borderRadius,
            filter: `brightness(${altitudeIntensity * dayNightBrightness}) contrast(${(1 + windEffect.turbulence) * contrastModifier}) blur(${precipEffect.blur * 0.3}px) saturate(${100 - (precipEffect.desaturation * 50)}%)`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    updateAura() {
        const lat = this.latitude.value;
        const lon = this.longitude.value;
        const alt = parseFloat(this.altitude.value);
        const clouds = parseFloat(this.cloudCover.value);
        const temp = parseFloat(this.temperature.value);
        const aqi = parseFloat(this.airQuality.value);
        const wind = parseFloat(this.windSpeed.value);
        const precip = parseFloat(this.precipitation.value);

        // Calculate base parameters
        const baseHue = this.getBaseHue(lat, lon);
        const tempHue = this.adjustTemperatureHue(baseHue, temp);
        const saturation = this.getAirQualitySaturation(aqi);
        const windEffect = this.getWindGradientEffect(wind);
        const altitudeIntensity = this.getAltitudeEffect(alt);
        const precipEffect = this.getPrecipitationEffect(precip, temp);

        const params = {
            baseHue,
            tempHue,
            saturation,
            windEffect,
            altitudeIntensity,
            clouds,
            precip,
            wind,
            precipEffect,
            weatherData: this.weatherData
        };

        // Generate aura based on current mode
        // If mode is 'randomizer', pick a random mode for this generation
        let modeToUse = this.currentMode;
        if (this.currentMode === 'randomizer') {
            const modes = ['radial', 'layered', 'swirl', 'linear', 'particle', 'fractal'];
            modeToUse = modes[Math.floor(Math.random() * modes.length)];
        }
        
        let auraConfig;
        switch (modeToUse) {
            case 'radial':
                auraConfig = this.generateRadialAura(params);
                break;
            case 'layered':
                auraConfig = this.generateLayeredAura(params);
                break;
            case 'swirl':
                auraConfig = this.generateSwirlAura(params);
                break;
            case 'linear':
                auraConfig = this.generateLinearAura(params);
                break;
            case 'particle':
                auraConfig = this.generateParticleAura(params);
                break;
            case 'fractal':
                auraConfig = this.generateFractalAura(params);
                break;
            default:
                auraConfig = this.generateRadialAura(params);
        }

        // Apply the aura configuration
        this.aura.style.width = `${auraConfig.size}px`;
        this.aura.style.height = `${auraConfig.size}px`;
        this.aura.style.background = auraConfig.background;
        this.aura.style.clipPath = auraConfig.clipPath;
        this.aura.style.borderRadius = auraConfig.borderRadius || '0%';
        this.aura.style.filter = auraConfig.filter || 'none';
        this.aura.style.transform = auraConfig.transform || 'none';
        this.aura.style.boxShadow = auraConfig.boxShadow || 'none';
        // Use opacity from aura config if provided, otherwise default
        const baseOpacity = 0.3 + (clouds / 100) * 0.7;
        this.aura.style.opacity = auraConfig.opacity !== undefined ? auraConfig.opacity * baseOpacity : baseOpacity;
        
        // Wind animation - natural breathing effect
        // Higher wind = faster breathing, but with more natural timing
        const baseDuration = Math.max(2 - (wind / 100), 0.8); // Slower base for more natural feel
        // Use cubic-bezier for more organic, natural breathing curve
        this.aura.style.animation = `pulse ${baseDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`;
        
        // Update inclement display after aura is updated
        this.updateInclementDisplay();
    }

    async randomize() {
        this.searchStatus.textContent = 'Finding random place...';
        this.searchStatus.className = 'search-status';
        
        // Curated list of interesting places around the world - cities, landmarks, and unique locations
        const places = [
            // Major Cities
            'Tokyo, Japan', 'New York, USA', 'London, UK', 'Paris, France', 'Sydney, Australia',
            'Mumbai, India', 'São Paulo, Brazil', 'Cairo, Egypt', 'Istanbul, Turkey', 'Bangkok, Thailand',
            'Mexico City, Mexico', 'Buenos Aires, Argentina', 'Lagos, Nigeria', 'Jakarta, Indonesia', 'Seoul, South Korea',
            'Moscow, Russia', 'Berlin, Germany', 'Madrid, Spain', 'Rome, Italy', 'Amsterdam, Netherlands',
            'Vancouver, Canada', 'Dubai, UAE', 'Singapore', 'Hong Kong', 'Shanghai, China',
            'Los Angeles, USA', 'Chicago, USA', 'San Francisco, USA', 'Miami, USA', 'Seattle, USA',
            'Denver, USA', 'St. Louis, USA', 'Portland, USA', 'Boston, USA', 'Austin, USA',
            'Reykjavik, Iceland', 'Oslo, Norway', 'Stockholm, Sweden', 'Helsinki, Finland', 'Copenhagen, Denmark',
            'Lima, Peru', 'Bogotá, Colombia', 'Santiago, Chile', 'Caracas, Venezuela',
            'Nairobi, Kenya', 'Cape Town, South Africa', 'Casablanca, Morocco', 'Tunis, Tunisia', 'Accra, Ghana',
            'Kathmandu, Nepal', 'Lhasa, Tibet', 'Ulaanbaatar, Mongolia', 'Almaty, Kazakhstan', 'Tashkent, Uzbekistan',
            'Anchorage, USA', 'Fairbanks, USA', 'Yellowknife, Canada', 'Nuuk, Greenland', 'Longyearbyen, Svalbard',
            'Honolulu, USA', 'Fiji', 'Tahiti', 'Bora Bora', 'Maldives',
            // Landmarks & Natural Features
            'Mount Everest Base Camp', 'Kilimanjaro', 'Machu Picchu', 'Grand Canyon', 'Sahara Desert',
            'Amazon Rainforest', 'Siberia', 'Patagonia', 'Death Valley, USA', 'Atacama Desert, Chile',
            'Gobi Desert, Mongolia', 'Namib Desert, Namibia', 'Great Barrier Reef, Australia', 'Iguazu Falls, Argentina',
            'Niagara Falls', 'Mount Fuji, Japan', 'Mount Kilimanjaro, Tanzania', 'Mount Rainier, USA',
            // Remote & Unique Locations
            'Antarctica', 'McMurdo Station, Antarctica', 'South Pole', 'North Pole',
            'Point Nemo, Pacific Ocean', 'Bouvet Island', 'Tristan da Cunha', 'Easter Island',
            'Svalbard, Norway', 'Alert, Nunavut, Canada', 'Oymyakon, Russia', 'Vostok Station, Antarctica',
            // Ocean Locations (using approximate coordinates as place names)
            'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Southern Ocean',
            'Mid-Atlantic Ridge', 'Mariana Trench', 'Hawaii', 'Galapagos Islands', 'Madagascar',
            // Extreme Locations
            'Dallol, Ethiopia', 'Lut Desert, Iran', 'Salar de Uyuni, Bolivia', 'Danakil Depression, Ethiopia',
            'Lake Baikal, Russia', 'Dead Sea', 'Caspian Sea', 'Lake Titicaca, Peru'
        ];
        
        // Pick a random place
        const randomPlace = places[Math.floor(Math.random() * places.length)];
        
        // Special coordinates for ocean locations and unique places
        const specialPlaces = {
            'Pacific Ocean': { lat: -10.0, lon: -140.0, name: 'Pacific Ocean' },
            'Atlantic Ocean': { lat: 30.0, lon: -30.0, name: 'Atlantic Ocean' },
            'Indian Ocean': { lat: -20.0, lon: 80.0, name: 'Indian Ocean' },
            'Arctic Ocean': { lat: 80.0, lon: 0.0, name: 'Arctic Ocean' },
            'Southern Ocean': { lat: -60.0, lon: 0.0, name: 'Southern Ocean' },
            'Antarctica': { lat: -75.0, lon: 0.0, name: 'Antarctica' },
            'South Pole': { lat: -90.0, lon: 0.0, name: 'South Pole' },
            'North Pole': { lat: 90.0, lon: 0.0, name: 'North Pole' },
            'Point Nemo, Pacific Ocean': { lat: -48.8767, lon: -123.3933, name: 'Point Nemo, Pacific Ocean' },
            'Mid-Atlantic Ridge': { lat: 0.0, lon: -25.0, name: 'Mid-Atlantic Ridge' },
            'Mariana Trench': { lat: 11.35, lon: 142.2, name: 'Mariana Trench' }
        };
        
        // Check if it's a special place with predefined coordinates
        let lat, lon, placeName;
        if (specialPlaces[randomPlace]) {
            const special = specialPlaces[randomPlace];
            lat = special.lat.toFixed(4);
            lon = special.lon.toFixed(4);
            placeName = special.name;
        } else {
            // Search for this place using Nominatim
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(randomPlace)}&limit=1`,
                    {
                        headers: {
                            'User-Agent': 'WeatherAuraGenerator/1.0'
                        }
                    }
                );
                
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const result = data[0];
                    lat = parseFloat(result.lat).toFixed(4);
                    lon = parseFloat(result.lon).toFixed(4);
                    placeName = result.display_name;
                } else {
                    throw new Error('Place not found');
                }
            } catch (error) {
                this.searchStatus.textContent = 'Could not find random place';
                this.searchStatus.className = 'search-status error';
                return;
            }
        }
        
        // Set coordinates
        if (lat && lon) {
            this.latitude.value = lat;
            this.longitude.value = lon;
            
            // Get elevation
            let altitude = 100;
            try {
                const elevResponse = await fetch(
                    `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
                );
                const elevData = await elevResponse.json();
                if (elevData.elevation && elevData.elevation[0] !== undefined) {
                    altitude = Math.round(elevData.elevation[0]);
                    this.altitude.value = altitude;
                }
            } catch (e) {
                // Keep default altitude
            }
            
            // Update location display
            const locationName = this.updateLocationDisplay(placeName);
            if (!locationName) {
                this.locationDisplay.textContent = placeName.split(',')[0] || randomPlace;
            }
            this.locationSearch.value = placeName;
            this.searchStatus.textContent = `Found: ${placeName}`;
            this.searchStatus.className = 'search-status success';
            
            // Automatically fetch live weather data
            await this.fetchLiveWeather(true); // silent mode
            
            // Fallback to realistic values if live data didn't work
            if (!this.temperature.value || this.temperature.value === '20') {
                this.temperature.value = this.generateRealisticTemperature(lat, altitude);
            }
            if (!this.airQuality.value || this.airQuality.value === '50') {
                this.airQuality.value = this.generateRealisticAQI(lat, lon, altitude);
            }
            if (!this.windSpeed.value || this.windSpeed.value === '10') {
                this.windSpeed.value = this.generateRealisticWindSpeed(lat, lon, altitude);
            }
            if (!this.precipitation.value || this.precipitation.value === '0') {
                const cloudCover = parseFloat(this.cloudCover.value);
                this.precipitation.value = this.generateRealisticPrecipitation(cloudCover, lat, altitude).toFixed(1);
            }
            
            // Only change mode if current mode is 'randomizer'
            if (this.currentMode === 'randomizer') {
                // Randomizer mode will pick a random mode during aura generation
            }
            
            this.updateValueDisplays();
            this.updateAura();
        } else {
            this.searchStatus.textContent = 'Could not find random place';
            this.searchStatus.className = 'search-status error';
        }
    }

    reset() {
        this.latitude.value = 40.7128; // New York
        this.longitude.value = -74.0060;
        this.altitude.value = 100;
        this.cloudCover.value = 50;
        this.temperature.value = 20;
        this.airQuality.value = 50;
        this.windSpeed.value = 10;
        this.precipitation.value = 0;
        
        // Reset location display
        this.locationDisplay.textContent = 'New York, NY';
        this.locationSearch.value = '';
        this.searchStatus.textContent = '';
        
        // Reset to radial mode
        this.modeButtons.forEach(btn => {
            if (btn.dataset.mode === 'radial') {
                btn.classList.add('active');
                this.currentMode = 'radial';
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.updateValueDisplays();
        this.updateAura();
    }

    reset() {
        // Reset all input values to defaults
        this.latitude.value = 40.7128;
        this.longitude.value = -74.0060;
        this.altitude.value = 100;
        this.cloudCover.value = 50;
        this.temperature.value = 20;
        this.airQuality.value = 50;
        this.windSpeed.value = 10;
        this.precipitation.value = 0;
        
        // Reset location display
        this.locationDisplay.textContent = 'New York, NY';
        this.locationSearch.value = '';
        this.searchStatus.textContent = '';
        
        // Reset to radial mode
        this.modeButtons.forEach(btn => {
            if (btn.dataset.mode === 'radial') {
                btn.classList.add('active');
                this.currentMode = 'radial';
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.updateValueDisplays();
        this.updateAura();
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% {
            transform: scale(1);
        }
        40% {
            transform: scale(1.03);
        }
        60% {
            transform: scale(1.03);
        }
        100% {
            transform: scale(1);
        }
    }
    
    .aura-visualization {
        transition: clip-path 0.5s ease, background 0.5s ease, filter 0.5s ease;
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WeatherAura();
});
