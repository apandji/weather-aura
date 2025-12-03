// Weather Aura Now - Simplified version for current location
class WeatherAuraNow {
    constructor() {
        this.currentMode = 'linear';
        this.weatherData = {
            humidity: 50,
            pressure: 1013,
            uvIndex: 5,
            visibility: 10,
            windDirection: 0,
            isDay: 1,
            weatherCode: 0
        };
        this.currentWeather = {};
        this.showingDetails = false;
        this.initializeElements();
        this.attachEventListeners();
        this.getUserLocation();
    }

    initializeElements() {
        this.aura = document.getElementById('aura');
        this.locationName = document.getElementById('location-name');
        this.coordinates = document.getElementById('coordinates');
        this.elevation = document.getElementById('elevation');
        this.weatherDetails = document.getElementById('weather-details');
        this.detailTemp = document.getElementById('detail-temp');
        this.detailWind = document.getElementById('detail-wind');
        this.detailAir = document.getElementById('detail-air');
        this.detailClouds = document.getElementById('detail-clouds');
        this.detailPrecip = document.getElementById('detail-precip');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.errorMessage = document.getElementById('error-message');
        this.collectedDate = document.getElementById('collected-date');
        this.modeButtons = document.querySelectorAll('.mode-btn');
        this.inclementDisplay = document.getElementById('inclement-display');
        this.inclementItem = document.getElementById('inclement-item');
        this.inclementTooltip = document.getElementById('inclement-tooltip');
        this.currentInclementData = null;
    }

    attachEventListeners() {
        this.aura.addEventListener('click', () => this.toggleDetails());
        this.weatherDetails.addEventListener('click', () => this.toggleDetails());
        this.refreshBtn.addEventListener('click', () => this.refreshAura());
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMode = btn.dataset.mode;
                this.updateAura();
            });
        });
        
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

    async getUserLocation() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by your browser.');
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            this.coordinates.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            this.errorMessage.classList.add('hidden');

            // Get elevation
            await this.getElevation(lat, lon);

            // Reverse geocode
            await this.reverseGeocode(lat, lon);

            // Fetch weather data
            await this.fetchWeatherData(lat, lon);
        } catch (error) {
            console.error('Location error:', error);
            this.showError('Unable to get your location. Please enable location permissions and refresh.');
        }
    }

    async getElevation(lat, lon) {
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
            );
            const data = await response.json();
            if (data.elevation && data.elevation[0] !== undefined) {
                this.elevation.textContent = `${Math.round(data.elevation[0])}m`;
            } else {
                this.elevation.textContent = '—';
            }
        } catch (error) {
            console.warn('Elevation fetch failed:', error);
            this.elevation.textContent = '—';
        }
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
                {
                    headers: {
                        'User-Agent': 'WeatherAuraNow/1.0'
                    }
                }
            );
            const data = await response.json();
            
            if (data && data.address) {
                const address = data.address;
                let locationName = '';
                
                // Build location name from address components
                if (address.city) locationName = address.city;
                else if (address.town) locationName = address.town;
                else if (address.village) locationName = address.village;
                else if (address.municipality) locationName = address.municipality;
                
                if (address.state) {
                    locationName = locationName ? `${locationName}, ${address.state}` : address.state;
                } else if (address.region) {
                    locationName = locationName ? `${locationName}, ${address.region}` : address.region;
                }
                
                if (!locationName && address.country) {
                    locationName = address.country;
                }
                
                this.locationName.textContent = locationName || 'Unknown Location';
            } else {
                this.locationName.textContent = 'Unknown Location';
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            this.locationName.textContent = 'Unknown Location';
        }
    }

    async fetchWeatherData(lat, lon) {
        this.refreshBtn.disabled = true;
        
        try {
            // Fetch current weather
            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloud_cover,wind_speed_10m,precipitation,relative_humidity_2m,surface_pressure,uv_index,visibility,wind_direction_10m,is_day,weather_code&wind_speed_unit=kmh&precipitation_unit=mm`
            );
            
            const weatherData = await weatherResponse.json();
            
            if (weatherData && weatherData.current) {
                const current = weatherData.current;
                
                this.currentWeather = {
                    temperature: Math.round(current.temperature_2m || 20),
                    cloudCover: Math.round(current.cloud_cover || 50),
                    windSpeed: Math.round(current.wind_speed_10m || 10),
                    precipitation: Math.max(0, current.precipitation || 0).toFixed(1),
                    altitude: parseFloat(this.elevation.textContent) || 100
                };
                
                // Store additional weather data
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
            
            // Fetch air quality
            try {
                const aqiResponse = await fetch(
                    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`
                );
                
                const aqiData = await aqiResponse.json();
                
                if (aqiData && aqiData.current && aqiData.current.us_aqi !== undefined) {
                    this.currentWeather.airQuality = Math.round(aqiData.current.us_aqi);
                } else {
                    this.currentWeather.airQuality = 50;
                }
            } catch (aqiError) {
                console.warn('Air quality data not available:', aqiError);
                this.currentWeather.airQuality = 50;
            }
            
            // Update collected date with detailed timestamp
            const now = new Date();
            const month = now.toLocaleString('default', { month: 'long' });
            const day = now.getDate();
            const year = now.getFullYear();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            this.collectedDate.textContent = `Collected ${month} ${day}/${year} at ${hours}:${minutes}:${seconds}`;
            
            // Update details display
            this.updateDetailsDisplay();
            
            // Calculate and update inclement score
            this.updateInclementDisplay();
            
            // Generate aura
            this.updateAura();
            
        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError('Failed to fetch weather data. Please try again.');
        } finally {
            this.refreshBtn.disabled = false;
        }
    }

    updateDetailsDisplay() {
        this.detailTemp.textContent = `${this.currentWeather.temperature}°C`;
        this.detailWind.textContent = `${this.currentWeather.windSpeed} km/h`;
        
        const aqi = this.currentWeather.airQuality || 50;
        const aqiLabel = this.getAirQualityLabel(aqi);
        this.detailAir.textContent = `${aqiLabel} (${aqi})`;
        
        this.detailClouds.textContent = `${this.currentWeather.cloudCover}%`;
        this.detailPrecip.textContent = `${this.currentWeather.precipitation} mm/h`;
    }

    updateInclementDisplay() {
        // Try to find element if not already found (in case DOM wasn't ready)
        if (!this.inclementDisplay) {
            this.inclementDisplay = document.getElementById('inclement-display');
        }
        
        if (!this.inclementDisplay) {
            console.warn('Inclement display element not found');
            return;
        }
        
        // Check if we have weather data
        if (!this.currentWeather || Object.keys(this.currentWeather).length === 0) {
            console.warn('No weather data available for inclement score calculation');
            this.inclementDisplay.textContent = '—';
            return;
        }
        
        try {
            // Always recalculate with current weather data
            const wind = this.currentWeather.windSpeed || 10;
            const precip = parseFloat(this.currentWeather.precipitation || 0);
            const clouds = this.currentWeather.cloudCover || 50;
            
            this.currentInclementData = this.calculateInclementScore(
                this.weatherData,
                wind,
                precip,
                clouds
            );
            
            if (!this.currentInclementData || this.currentInclementData.score === undefined || isNaN(this.currentInclementData.score)) {
                console.warn('Inclement score calculation returned invalid data:', this.currentInclementData);
                this.inclementDisplay.textContent = '—';
                return;
            }
            
            const score = this.currentInclementData.score;
            this.inclementDisplay.textContent = score.toFixed(2);
            
            // Update tooltip content
            this.updateInclementTooltip();
        } catch (error) {
            console.error('Error calculating inclement score:', error);
            this.inclementDisplay.textContent = '—';
        }
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
        
        // Add visual aura explanation
        html += `<div class="tooltip-section">`;
        html += `<div class="tooltip-title">Visual Aura Effects:</div>`;
        
        // Explain how factors affect the aura visually
        const auraEffects = [];
        
        if (score > 0.1) {
            auraEffects.push('Higher score = sharper, more angular shape');
        }
        
        const windFactor = factors.find(f => f.name === 'wind');
        if (windFactor && windFactor.value > 0.3) {
            auraEffects.push('High wind = faster animation, more layers');
        }
        
        const precipFactor = factors.find(f => f.name === 'precipitation');
        if (precipFactor && precipFactor.value > 0.3) {
            auraEffects.push('Precipitation = blur effect, reduced saturation');
        }
        
        const cloudFactor = factors.find(f => f.name === 'cloudCover');
        if (cloudFactor && cloudFactor.value > 0) {
            auraEffects.push('Cloud cover = shape complexity (polygon sides)');
        }
        
        if (auraEffects.length === 0) {
            auraEffects.push('Low score = smooth, rounded shape');
        }
        
        auraEffects.forEach(effect => {
            html += `<div class="tooltip-value" style="font-size: 0.7rem; margin-top: 2px;">• ${effect}</div>`;
        });
        
        html += `</div>`;
        
        tooltipContent.innerHTML = html;
    }

    getAirQualityLabel(aqi) {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy for Sensitive';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    }

    toggleDetails() {
        this.showingDetails = !this.showingDetails;
        
        if (this.showingDetails) {
            // Make aura smaller
            this.aura.classList.add('small');
            // Show details with slide animation
            this.weatherDetails.classList.remove('hidden');
            // Use setTimeout to trigger transition after removing hidden class
            setTimeout(() => {
                this.weatherDetails.classList.add('visible');
            }, 10);
        } else {
            // Restore aura to full size
            this.aura.classList.remove('small');
            // Hide details with slide animation
            this.weatherDetails.classList.remove('visible');
            setTimeout(() => {
                this.weatherDetails.classList.add('hidden');
            }, 400); // Wait for transition to complete
        }
    }

    async refreshAura() {
        // Hide details if showing
        if (this.showingDetails) {
            this.showingDetails = false;
            this.aura.classList.remove('small');
            this.weatherDetails.classList.remove('visible');
            setTimeout(() => {
                this.weatherDetails.classList.add('hidden');
            }, 400);
        }
        
        const coords = this.coordinates.textContent.split(', ');
        if (coords.length === 2) {
            const lat = parseFloat(coords[0]);
            const lon = parseFloat(coords[1]);
            await this.fetchWeatherData(lat, lon);
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    // Helper methods for aura generation
    getBaseHue(lat, lon) {
        const latNorm = ((parseFloat(lat) + 90) / 180) * 360;
        const lonNorm = ((parseFloat(lon) + 180) / 360) * 360;
        return (latNorm + lonNorm) % 360;
    }

    adjustTemperatureHue(baseHue, temp) {
        const normalized = (parseFloat(temp) + 40) / 90;
        const shift = 120 - (normalized * 180);
        return (baseHue + shift) % 360;
    }

    getAirQualitySaturation(aqi) {
        const normalized = Math.min(aqi / 300, 1);
        return 80 - (normalized * 50);
    }

    getPolygonSides(cloudCover) {
        const clouds = parseFloat(cloudCover);
        if (clouds === 0) {
            return 999;
        }
        if (clouds < 30) {
            return Math.round(999 - ((clouds / 30) * 996));
        }
        return Math.round(3 + ((clouds - 30) / 10));
    }

    generatePolygonClipPath(sides, size) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            const x = 50 + 50 * Math.cos(angle);
            const y = 50 + 50 * Math.sin(angle);
            points.push(`${x}% ${y}%`);
        }
        return `polygon(${points.join(', ')})`;
    }

    getWindGradientEffect(windSpeed) {
        const wind = parseFloat(windSpeed);
        return {
            layers: Math.max(2, Math.min(8, Math.floor(2 + wind / 25))),
            spread: Math.min(40, wind / 5),
            turbulence: wind / 100
        };
    }

    getAltitudeEffect(altitude) {
        const alt = parseFloat(altitude);
        return 0.5 + (alt / 8848) * 0.5;
    }

    getPrecipitationEffect(precipitation, temperature) {
        const precip = parseFloat(precipitation);
        const temp = parseFloat(temperature);
        const isSnow = temp < 0;
        const intensity = Math.min(1, precip / 50);
        
        return {
            intensity: intensity,
            blur: precip / 10,
            desaturation: precip / 100,
            streakCount: Math.floor(precip / 5),
            isSnow: isSnow,
            verticalShift: precip / 20,
            particleDensity: precip / 2,
            dropletCount: Math.floor(precip / 3),
            glossIntensity: intensity * 0.6,
            highlightCount: Math.floor(precip / 4)
        };
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

    // MODE: Linear
    generateLinearAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const numLayers = windEffect.layers;
        
        for (let i = 0; i < numLayers; i++) {
            const progress = i / (numLayers - 1);
            const hue = (tempHue + progress * 80) % 360;
            const lightness = 40 + progress * 30;
            
            const windDir = weatherData?.windDirection || 0;
            const baseAngle = windDir + (windEffect.turbulence * 180);
            const angle = baseAngle + (i * 45);
            
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
        
        const windDir = weatherData?.windDirection || 0;
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.75;
        const uvBrightness = 1 + ((weatherData?.uvIndex || 5) / 11) * 0.2;
        
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            const rainAngle = (windDir + 90) % 360;
            
            for (let i = 0; i < precipEffect.streakCount * 2; i++) {
                const x = 5 + (i * (90 / Math.max(1, precipEffect.streakCount * 2)));
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
        
        const wetGloss = precipEffect.intensity > 0.1 ? `contrast(${1 + precipEffect.glossIntensity * 0.2}) brightness(${1 + precipEffect.glossIntensity * 0.1})` : '';
        
        return {
            background: gradients.join(', '),
            clipPath: this.generatePolygonClipPath(this.getPolygonSides(clouds), size),
            filter: `brightness(${altitudeIntensity * uvBrightness * dayNightBrightness}) blur(${precipEffect.blur}px) saturate(${100 - (precipEffect.desaturation * 50)}%) ${wetGloss}`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    // MODE: Layered
    generateLayeredAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const numLayers = windEffect.layers;
        
        const windDir = weatherData?.windDirection || 0;
        const useLinear = windEffect.turbulence > 0.5;
        const baseGradientAngle = windDir;
        
        for (let i = 0; i < numLayers; i++) {
            const progress = i / (numLayers - 1);
            const hue = (tempHue + progress * 60) % 360;
            
            if (useLinear && i % 2 === 0) {
                const layerAngle = (baseGradientAngle + (i * 30)) % 360;
                gradients.push(
                    `linear-gradient(${layerAngle}deg, 
                        hsla(${hue}, ${saturation}%, ${50 + progress * 20}%, ${0.8 - progress * 0.3}) 0%, 
                        transparent ${50 + windEffect.spread}%)`
                );
            } else {
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
        
        const pressureEffect = weatherData?.pressure ? (1013 - weatherData.pressure) / 50 : 0;
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.75;
        
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            const streakColor = precipEffect.isSnow ? 
                `hsla(${tempHue}, ${adjustedSaturation}%, 85%, ${precipEffect.intensity * 0.35})` :
                `hsla(${tempHue}, ${adjustedSaturation}%, 65%, ${precipEffect.intensity * 0.45})`;
            
            const rainAngle = (windDir + 90) % 360;
            
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
        
        const wetGloss = precipEffect.intensity > 0.1 ? `contrast(${1 + precipEffect.glossIntensity * 0.2}) brightness(${1 + precipEffect.glossIntensity * 0.1})` : '';
        
        return {
            background: gradients.join(', '),
            clipPath: this.generatePolygonClipPath(this.getPolygonSides(clouds), size),
            filter: `brightness(${altitudeIntensity * dayNightBrightness}) blur(${precipEffect.blur}px) saturate(${100 - (precipEffect.desaturation * 50)}%) ${wetGloss}`,
            boxShadow: `${shadowOffset + pressureEffect}px ${shadowOffset + pressureEffect}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    // MODE: Particle
    generateParticleAura(params) {
        const { baseHue, tempHue, saturation, windEffect, altitudeIntensity, clouds, precip, wind, precipEffect, weatherData } = params;
        const size = 400;
        
        const gradients = [];
        const windDir = weatherData?.windDirection || 0;
        const windRadians = (windDir * Math.PI) / 180;
        const windDrift = windEffect.turbulence * 15;
        
        const baseParticleCount = 50 + windEffect.turbulence * 100;
        const particleCount = Math.max(30, Math.min(200, baseParticleCount + precipEffect.particleDensity));
        const spreadRange = 20 + windEffect.spread * 2;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * spreadRange;
            const windBias = (Math.random() - 0.5) * windDrift;
            const x = 50 + Math.cos(angle) * distance + Math.cos(windRadians) * windBias;
            const y = 50 + Math.sin(angle) * distance + Math.sin(windRadians) * windBias;
            
            const hueVariation = (i * 15 + tempHue + windEffect.turbulence * 60) % 360;
            const hue = hueVariation;
            const lightness = 30 + (i % 4) * 20;
            const particleSize = 3 + Math.random() * 8 + windEffect.turbulence * 5;
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
        
        const humiditySpread = weatherData?.humidity ? (100 - weatherData.humidity) / 50 : 1;
        const dayNightBrightness = weatherData?.isDay ? 1 : 0.8;
        
        const adjustedSaturation = Math.max(0, saturation - (precipEffect.desaturation * 100));
        if (precipEffect.intensity > 0.1) {
            const rainAngle = (windDir + 90) % 360;
            
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
        
        return {
            background: gradients.join(', '),
            clipPath: this.generatePolygonClipPath(this.getPolygonSides(clouds), size),
            filter: `brightness(${altitudeIntensity * dayNightBrightness}) blur(${precipEffect.blur * 0.5}px) saturate(${100 - (precipEffect.desaturation * 50)}%)`,
            boxShadow: `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`,
            size: size
        };
    }

    updateAura() {
        if (!this.currentWeather.temperature && this.currentWeather.temperature !== 0) {
            return; // No weather data yet
        }

        const coords = this.coordinates.textContent.split(', ');
        if (coords.length !== 2) return;
        
        const lat = parseFloat(coords[0]);
        const lon = parseFloat(coords[1]);
        const alt = this.currentWeather.altitude || 100;
        const clouds = this.currentWeather.cloudCover || 50;
        const temp = this.currentWeather.temperature || 20;
        const aqi = this.currentWeather.airQuality || 50;
        const wind = this.currentWeather.windSpeed || 10;
        const precip = parseFloat(this.currentWeather.precipitation || 0);

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

        let auraConfig;
        switch (this.currentMode) {
            case 'linear':
                auraConfig = this.generateLinearAura(params);
                break;
            case 'layered':
                auraConfig = this.generateLayeredAura(params);
                break;
            case 'particle':
                auraConfig = this.generateParticleAura(params);
                break;
            default:
                auraConfig = this.generateLinearAura(params);
        }

        // Apply the aura configuration
        // Use responsive sizing instead of fixed pixels
        this.aura.style.width = '100%';
        this.aura.style.maxWidth = `${auraConfig.size}px`;
        this.aura.style.background = auraConfig.background;
        this.aura.style.clipPath = auraConfig.clipPath;
        this.aura.style.filter = auraConfig.filter || 'none';
        this.aura.style.transform = auraConfig.transform || 'none';
        this.aura.style.boxShadow = auraConfig.boxShadow || 'none';
        
        const baseOpacity = 0.3 + (clouds / 100) * 0.7;
        this.aura.style.opacity = auraConfig.opacity !== undefined ? auraConfig.opacity * baseOpacity : baseOpacity;
        
        // Wind animation
        const baseDuration = Math.max(2 - (wind / 100), 0.8);
        this.aura.style.animation = `pulse ${baseDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`;
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
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WeatherAuraNow();
});

