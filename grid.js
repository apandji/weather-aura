// Weather Aura Grid - Multiple locations with time projection
class WeatherAuraGrid {
    constructor() {
        this.currentMode = 'linear'; // Same mode for all auras
        this.locations = [];
        this.forecastData = new Map(); // Map of location ID to forecast data
        this.currentTimeOffset = 0; // Hours from now (0-24)
        this.usedPlaces = new Set(); // Track used place names to prevent duplicates
        this.isPlaying = false; // Auto-play state
        this.playInterval = null; // Auto-play interval
        this.detailedView = false; // Detailed view toggle state
        this.initializeElements();
        this.attachEventListeners();
        this.calculateGridSize();
        this.generateInitialGrid();
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const oldCount = this.targetAuraCount;
                this.calculateGridSize();
                // Only regenerate if the target count changed significantly
                if (Math.abs(this.targetAuraCount - oldCount) > 2) {
                    this.generateInitialGrid();
                }
            }, 500);
        });
    }

    initializeElements() {
        this.gridContainer = document.getElementById('grid-container');
        this.timeSlider = document.getElementById('time-slider');
        this.timeLabel = document.getElementById('time-label');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.detailToggleBtn = document.getElementById('detail-toggle');
    }

    attachEventListeners() {
        this.timeSlider.addEventListener('input', (e) => {
            this.currentTimeOffset = parseInt(e.target.value);
            this.updateTimeLabel();
            this.updateAllAuras();
        });

        this.refreshBtn.addEventListener('click', () => {
            this.refreshAll();
        });

        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        this.detailToggleBtn.addEventListener('click', () => {
            this.toggleDetailedView();
        });
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        
        if (this.isPlaying) {
            this.playPauseBtn.classList.add('playing');
            this.startAutoPlay();
        } else {
            this.playPauseBtn.classList.remove('playing');
            this.stopAutoPlay();
        }
    }

    startAutoPlay() {
        // Play speed: 1 hour per second (24 seconds for full cycle)
        const playSpeed = 1000; // milliseconds per hour
        let currentHour = this.currentTimeOffset;
        
        this.playInterval = setInterval(() => {
            currentHour++;
            if (currentHour > 24) {
                currentHour = 0; // Loop back to start
            }
            
            this.currentTimeOffset = currentHour;
            this.timeSlider.value = currentHour;
            this.updateTimeLabel();
            this.updateAllAuras();
        }, playSpeed);
    }

    stopAutoPlay() {
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    toggleDetailedView() {
        this.detailedView = !this.detailedView;
        
        const cards = document.querySelectorAll('.aura-card');
        cards.forEach(card => {
            if (this.detailedView) {
                card.classList.add('detailed-view');
            } else {
                card.classList.remove('detailed-view');
            }
        });
        
        if (this.detailedView) {
            this.detailToggleBtn.classList.add('active');
            this.detailToggleBtn.querySelector('.toggle-text').textContent = 'Overview';
        } else {
            this.detailToggleBtn.classList.remove('active');
            this.detailToggleBtn.querySelector('.toggle-text').textContent = 'Details';
        }
        
        // Update weather details for all cards
        this.updateAllWeatherDetails();
    }

    calculateGridSize() {
        // Calculate how many auras can fit based on viewport
        const containerWidth = this.gridContainer.offsetWidth;
        const minAuraWidth = 200; // Minimum width per aura
        const gap = 20;
        const padding = 40;
        
        const availableWidth = containerWidth - padding;
        const aurasPerRow = Math.max(2, Math.floor((availableWidth + gap) / (minAuraWidth + gap)));
        
        // Calculate rows based on viewport height
        const containerHeight = window.innerHeight - 300; // Account for header and controls
        const minAuraHeight = 250; // Minimum height per aura card
        const rows = Math.max(2, Math.floor((containerHeight + gap) / (minAuraHeight + gap)));
        
        this.targetAuraCount = aurasPerRow * rows;
        
        // Determine initial batch size (10 for desktop, 4 for mobile)
        const isMobile = window.innerWidth < 600;
        this.initialBatchSize = isMobile ? 4 : 10;
        this.batchSize = isMobile ? 4 : 8; // Subsequent batches
    }

    async generateInitialGrid() {
        this.gridContainer.innerHTML = '';
        this.locations = [];
        this.forecastData.clear();
        this.usedPlaces.clear(); // Reset used places
        
        this.refreshBtn.disabled = true;

        // Get shuffled list of unique places
        const availablePlaces = this.getShuffledPlaces();
        
        // Create placeholder cards for all auras first
        const placeholders = [];
        for (let i = 0; i < this.targetAuraCount; i++) {
            const placeholder = this.createPlaceholderCard();
            this.gridContainer.appendChild(placeholder);
            placeholders.push(placeholder);
        }

        // Load first batch immediately
        const firstBatch = Math.min(this.initialBatchSize, this.targetAuraCount);
        for (let i = 0; i < firstBatch; i++) {
            const place = this.getNextUniquePlace(availablePlaces);
            if (!place) break; // No more unique places
            const placeholder = placeholders[i];
            placeholder.remove();
            await this.addLocation(place);
        }

        // Load remaining auras in batches
        if (this.targetAuraCount > firstBatch) {
            // Start loading remaining batches after a short delay
            setTimeout(() => {
                this.loadRemainingAuras(availablePlaces, firstBatch, placeholders);
            }, 100);
        } else {
            this.refreshBtn.disabled = false;
        }
    }

    createPlaceholderCard() {
        const card = document.createElement('div');
        card.className = 'aura-card placeholder';
        card.innerHTML = `
            <div class="location-name" style="opacity: 0.3;">Loading...</div>
            <div class="aura-visualization" style="background: #f0f0f0; opacity: 0.3;"></div>
            <div class="inclement-score" style="opacity: 0.3;">—</div>
        `;
        return card;
    }

    async loadRemainingAuras(availablePlaces, startIndex, placeholders) {
        const remaining = this.targetAuraCount - startIndex;
        let loaded = 0;
        
        // Load in batches with small delays between batches
        while (loaded < remaining) {
            const batchEnd = Math.min(loaded + this.batchSize, remaining);
            
            // Load batch in parallel
            const batchPromises = [];
            for (let i = startIndex + loaded; i < startIndex + batchEnd; i++) {
                const place = this.getNextUniquePlace(availablePlaces);
                if (!place) break; // No more unique places
                const placeholder = placeholders[i];
                
                batchPromises.push(
                    this.addLocation(place).then(() => {
                        if (placeholder && placeholder.parentNode) {
                            placeholder.remove();
                        }
                    })
                );
            }
            
            await Promise.all(batchPromises);
            loaded = batchEnd;
            
            // Small delay between batches to avoid overwhelming the API
            if (loaded < remaining) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        this.refreshBtn.disabled = false;
    }

    getNextUniquePlace(availablePlaces) {
        // Find next place that hasn't been used
        for (const place of availablePlaces) {
            if (!this.usedPlaces.has(place)) {
                this.usedPlaces.add(place);
                return place;
            }
        }
        // If we've used all places, return null (or could cycle through)
        return null;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    getShuffledPlaces() {
        const places = this.getRandomPlaces();
        return this.shuffleArray(places);
    }

    getRandomPlaces() {
        // Expanded list with much more variety
        return [
            // Major Cities - Americas
            'New York, USA', 'Los Angeles, USA', 'Chicago, USA', 'Houston, USA', 'Phoenix, USA',
            'Philadelphia, USA', 'San Antonio, USA', 'San Diego, USA', 'Dallas, USA', 'San Jose, USA',
            'Austin, USA', 'Jacksonville, USA', 'San Francisco, USA', 'Indianapolis, USA', 'Columbus, USA',
            'Fort Worth, USA', 'Charlotte, USA', 'Seattle, USA', 'Denver, USA', 'Washington, USA',
            'Boston, USA', 'El Paso, USA', 'Detroit, USA', 'Nashville, USA', 'Portland, USA',
            'Oklahoma City, USA', 'Las Vegas, USA', 'Memphis, USA', 'Louisville, USA', 'Baltimore, USA',
            'Milwaukee, USA', 'Albuquerque, USA', 'Tucson, USA', 'Fresno, USA', 'Sacramento, USA',
            'Kansas City, USA', 'Mesa, USA', 'Atlanta, USA', 'Omaha, USA', 'Raleigh, USA',
            'Miami, USA', 'Long Beach, USA', 'Virginia Beach, USA', 'Oakland, USA', 'Minneapolis, USA',
            'Tulsa, USA', 'Tampa, USA', 'Cleveland, USA', 'Wichita, USA', 'Arlington, USA',
            'Mexico City, Mexico', 'Guadalajara, Mexico', 'Monterrey, Mexico', 'Puebla, Mexico', 'Tijuana, Mexico',
            'Toronto, Canada', 'Montreal, Canada', 'Vancouver, Canada', 'Calgary, Canada', 'Ottawa, Canada',
            'Edmonton, Canada', 'Winnipeg, Canada', 'Quebec City, Canada', 'Hamilton, Canada', 'Kitchener, Canada',
            'São Paulo, Brazil', 'Rio de Janeiro, Brazil', 'Brasília, Brazil', 'Salvador, Brazil', 'Fortaleza, Brazil',
            'Belo Horizonte, Brazil', 'Manaus, Brazil', 'Curitiba, Brazil', 'Recife, Brazil', 'Porto Alegre, Brazil',
            'Buenos Aires, Argentina', 'Córdoba, Argentina', 'Rosario, Argentina', 'Mendoza, Argentina', 'Tucumán, Argentina',
            'Lima, Peru', 'Arequipa, Peru', 'Trujillo, Peru', 'Chiclayo, Peru', 'Piura, Peru',
            'Bogotá, Colombia', 'Medellín, Colombia', 'Cali, Colombia', 'Barranquilla, Colombia', 'Cartagena, Colombia',
            'Santiago, Chile', 'Valparaíso, Chile', 'Concepción, Chile', 'La Serena, Chile', 'Antofagasta, Chile',
            'Caracas, Venezuela', 'Maracaibo, Venezuela', 'Valencia, Venezuela', 'Barquisimeto, Venezuela',
            
            // Major Cities - Europe
            'London, UK', 'Manchester, UK', 'Birmingham, UK', 'Glasgow, UK', 'Liverpool, UK',
            'Leeds, UK', 'Edinburgh, UK', 'Bristol, UK', 'Cardiff, UK', 'Belfast, UK',
            'Paris, France', 'Lyon, France', 'Marseille, France', 'Toulouse, France', 'Nice, France',
            'Nantes, France', 'Strasbourg, France', 'Montpellier, France', 'Bordeaux, France', 'Lille, France',
            'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany', 'Cologne, Germany', 'Frankfurt, Germany',
            'Stuttgart, Germany', 'Düsseldorf, Germany', 'Dortmund, Germany', 'Essen, Germany', 'Leipzig, Germany',
            'Madrid, Spain', 'Barcelona, Spain', 'Valencia, Spain', 'Seville, Spain', 'Zaragoza, Spain',
            'Málaga, Spain', 'Murcia, Spain', 'Palma, Spain', 'Las Palmas, Spain', 'Bilbao, Spain',
            'Rome, Italy', 'Milan, Italy', 'Naples, Italy', 'Turin, Italy', 'Palermo, Italy',
            'Genoa, Italy', 'Bologna, Italy', 'Florence, Italy', 'Bari, Italy', 'Catania, Italy',
            'Amsterdam, Netherlands', 'Rotterdam, Netherlands', 'The Hague, Netherlands', 'Utrecht, Netherlands',
            'Moscow, Russia', 'Saint Petersburg, Russia', 'Novosibirsk, Russia', 'Yekaterinburg, Russia', 'Kazan, Russia',
            'Nizhny Novgorod, Russia', 'Chelyabinsk, Russia', 'Samara, Russia', 'Omsk, Russia', 'Rostov-on-Don, Russia',
            'Warsaw, Poland', 'Kraków, Poland', 'Łódź, Poland', 'Wrocław, Poland', 'Poznań, Poland',
            'Vienna, Austria', 'Graz, Austria', 'Linz, Austria', 'Salzburg, Austria', 'Innsbruck, Austria',
            'Prague, Czech Republic', 'Brno, Czech Republic', 'Ostrava, Czech Republic', 'Plzeň, Czech Republic',
            'Budapest, Hungary', 'Debrecen, Hungary', 'Szeged, Hungary', 'Miskolc, Hungary',
            'Stockholm, Sweden', 'Gothenburg, Sweden', 'Malmö, Sweden', 'Uppsala, Sweden', 'Linköping, Sweden',
            'Oslo, Norway', 'Bergen, Norway', 'Trondheim, Norway', 'Stavanger, Norway', 'Bærum, Norway',
            'Copenhagen, Denmark', 'Aarhus, Denmark', 'Odense, Denmark', 'Aalborg, Denmark',
            'Helsinki, Finland', 'Espoo, Finland', 'Tampere, Finland', 'Vantaa, Finland', 'Oulu, Finland',
            'Reykjavik, Iceland', 'Kópavogur, Iceland', 'Hafnarfjörður, Iceland',
            'Dublin, Ireland', 'Cork, Ireland', 'Limerick, Ireland', 'Galway, Ireland',
            'Lisbon, Portugal', 'Porto, Portugal', 'Amadora, Portugal', 'Braga, Portugal',
            'Athens, Greece', 'Thessaloniki, Greece', 'Patras, Greece', 'Heraklion, Greece',
            'Istanbul, Turkey', 'Ankara, Turkey', 'Izmir, Turkey', 'Bursa, Turkey', 'Antalya, Turkey',
            
            // Major Cities - Asia
            'Tokyo, Japan', 'Yokohama, Japan', 'Osaka, Japan', 'Nagoya, Japan', 'Sapporo, Japan',
            'Fukuoka, Japan', 'Kobe, Japan', 'Kawasaki, Japan', 'Kyoto, Japan', 'Saitama, Japan',
            'Seoul, South Korea', 'Busan, South Korea', 'Incheon, South Korea', 'Daegu, South Korea', 'Daejeon, South Korea',
            'Shanghai, China', 'Beijing, China', 'Guangzhou, China', 'Shenzhen, China', 'Chengdu, China',
            'Hangzhou, China', 'Wuhan, China', 'Xi\'an, China', 'Nanjing, China', 'Tianjin, China',
            'Hong Kong', 'Macau', 'Taipei, Taiwan', 'Kaohsiung, Taiwan', 'Taichung, Taiwan',
            'Mumbai, India', 'Delhi, India', 'Bangalore, India', 'Hyderabad, India', 'Ahmedabad, India',
            'Chennai, India', 'Kolkata, India', 'Surat, India', 'Pune, India', 'Jaipur, India',
            'Jakarta, Indonesia', 'Surabaya, Indonesia', 'Bandung, Indonesia', 'Medan, Indonesia', 'Semarang, Indonesia',
            'Bangkok, Thailand', 'Chiang Mai, Thailand', 'Pattaya, Thailand', 'Phuket, Thailand',
            'Manila, Philippines', 'Quezon City, Philippines', 'Caloocan, Philippines', 'Davao, Philippines',
            'Ho Chi Minh City, Vietnam', 'Hanoi, Vietnam', 'Da Nang, Vietnam', 'Hai Phong, Vietnam',
            'Singapore', 'Kuala Lumpur, Malaysia', 'George Town, Malaysia', 'Johor Bahru, Malaysia',
            'Dhaka, Bangladesh', 'Chittagong, Bangladesh', 'Khulna, Bangladesh',
            'Karachi, Pakistan', 'Lahore, Pakistan', 'Faisalabad, Pakistan', 'Rawalpindi, Pakistan', 'Multan, Pakistan',
            'Tehran, Iran', 'Mashhad, Iran', 'Isfahan, Iran', 'Karaj, Iran', 'Tabriz, Iran',
            'Baghdad, Iraq', 'Basra, Iraq', 'Mosul, Iraq', 'Erbil, Iraq',
            'Riyadh, Saudi Arabia', 'Jeddah, Saudi Arabia', 'Mecca, Saudi Arabia', 'Medina, Saudi Arabia', 'Dammam, Saudi Arabia',
            'Dubai, UAE', 'Abu Dhabi, UAE', 'Sharjah, UAE', 'Al Ain, UAE',
            'Tel Aviv, Israel', 'Jerusalem, Israel', 'Haifa, Israel', 'Beersheba, Israel',
            
            // Major Cities - Africa
            'Cairo, Egypt', 'Alexandria, Egypt', 'Giza, Egypt', 'Shubra El Kheima, Egypt',
            'Lagos, Nigeria', 'Kano, Nigeria', 'Ibadan, Nigeria', 'Abuja, Nigeria', 'Port Harcourt, Nigeria',
            'Kinshasa, DR Congo', 'Lubumbashi, DR Congo', 'Mbuji-Mayi, DR Congo', 'Kisangani, DR Congo',
            'Johannesburg, South Africa', 'Cape Town, South Africa', 'Durban, South Africa', 'Pretoria, South Africa',
            'Nairobi, Kenya', 'Mombasa, Kenya', 'Kisumu, Kenya', 'Nakuru, Kenya',
            'Addis Ababa, Ethiopia', 'Dire Dawa, Ethiopia', 'Mek\'ele, Ethiopia',
            'Dar es Salaam, Tanzania', 'Mwanza, Tanzania', 'Arusha, Tanzania', 'Dodoma, Tanzania',
            'Casablanca, Morocco', 'Rabat, Morocco', 'Fes, Morocco', 'Marrakech, Morocco', 'Tangier, Morocco',
            'Tunis, Tunisia', 'Sfax, Tunisia', 'Sousse, Tunisia',
            'Accra, Ghana', 'Kumasi, Ghana', 'Tamale, Ghana',
            'Algiers, Algeria', 'Oran, Algeria', 'Constantine, Algeria',
            
            // Major Cities - Oceania
            'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia', 'Adelaide, Australia',
            'Gold Coast, Australia', 'Newcastle, Australia', 'Canberra, Australia', 'Sunshine Coast, Australia', 'Wollongong, Australia',
            'Auckland, New Zealand', 'Wellington, New Zealand', 'Christchurch, New Zealand', 'Hamilton, New Zealand',
            'Honolulu, USA', 'Hilo, USA',
            'Fiji', 'Suva, Fiji', 'Nadi, Fiji',
            'Tahiti', 'Papeete, French Polynesia',
            'Bora Bora, French Polynesia',
            'Maldives', 'Malé, Maldives',
            'Port Moresby, Papua New Guinea',
            
            // Landmarks & Natural Features
            'Mount Everest Base Camp', 'Kilimanjaro', 'Machu Picchu', 'Grand Canyon', 'Sahara Desert',
            'Amazon Rainforest', 'Siberia', 'Patagonia', 'Death Valley, USA', 'Atacama Desert, Chile',
            'Gobi Desert, Mongolia', 'Namib Desert, Namibia', 'Great Barrier Reef, Australia', 'Iguazu Falls, Argentina',
            'Niagara Falls', 'Mount Fuji, Japan', 'Mount Kilimanjaro, Tanzania', 'Mount Rainier, USA',
            'Mount McKinley, USA', 'Mount Elbrus, Russia', 'Mount Blanc, France', 'Matterhorn, Switzerland',
            'Yellowstone National Park, USA', 'Yosemite National Park, USA', 'Grand Teton National Park, USA',
            'Banff National Park, Canada', 'Jasper National Park, Canada', 'Glacier National Park, USA',
            'Serengeti National Park, Tanzania', 'Kruger National Park, South Africa', 'Okavango Delta, Botswana',
            'Victoria Falls, Zambia', 'Angel Falls, Venezuela', 'Iguazu Falls, Brazil',
            'Great Wall of China', 'Taj Mahal, India', 'Petra, Jordan', 'Angkor Wat, Cambodia',
            'Stonehenge, UK', 'Easter Island', 'Galapagos Islands', 'Madagascar',
            
            // Remote & Unique Locations
            'Antarctica', 'McMurdo Station, Antarctica', 'South Pole', 'North Pole',
            'Point Nemo, Pacific Ocean', 'Bouvet Island', 'Tristan da Cunha',
            'Svalbard, Norway', 'Longyearbyen, Svalbard', 'Alert, Nunavut, Canada', 'Oymyakon, Russia', 'Vostok Station, Antarctica',
            'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Southern Ocean',
            'Mid-Atlantic Ridge', 'Mariana Trench',
            
            // Extreme Locations
            'Dallol, Ethiopia', 'Lut Desert, Iran', 'Salar de Uyuni, Bolivia', 'Danakil Depression, Ethiopia',
            'Lake Baikal, Russia', 'Dead Sea', 'Caspian Sea', 'Lake Titicaca, Peru',
            'Mount Washington, USA', 'Mount Cook, New Zealand', 'Aconcagua, Argentina',
            'K2, Pakistan', 'Kangchenjunga, Nepal', 'Lhotse, Nepal', 'Makalu, Nepal'
        ];
    }

    async addLocation(placeName) {
        const locationId = `loc-${Date.now()}-${Math.random()}`;
        
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

        let lat, lon, displayName;
        
        if (specialPlaces[placeName]) {
            const special = specialPlaces[placeName];
            lat = special.lat;
            lon = special.lon;
            displayName = special.name;
        } else {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1`,
                    {
                        headers: {
                            'User-Agent': 'WeatherAuraGrid/1.0'
                        }
                    }
                );
                
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const result = data[0];
                    lat = parseFloat(result.lat);
                    lon = parseFloat(result.lon);
                    displayName = result.display_name.split(',')[0] || placeName;
                } else {
                    return; // Skip if not found
                }
            } catch (error) {
                console.warn(`Failed to geocode ${placeName}:`, error);
                return;
            }
        }

        // Get elevation
        let altitude = 100;
        try {
            const elevResponse = await fetch(
                `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
            );
            const elevData = await elevResponse.json();
            if (elevData.elevation && elevData.elevation[0] !== undefined) {
                altitude = Math.round(elevData.elevation[0]);
            }
        } catch (e) {
            // Keep default altitude
        }

        // Create location object
        const location = {
            id: locationId,
            name: displayName,
            lat,
            lon,
            altitude
        };

        this.locations.push(location);

        // Fetch forecast data
        await this.fetchForecastData(location);

        // Create aura card
        this.createAuraCard(location);
    }

    async fetchForecastData(location) {
        try {
            // Fetch 24-hour hourly forecast
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&hourly=temperature_2m,cloud_cover,wind_speed_10m,precipitation,relative_humidity_2m,surface_pressure,uv_index,visibility,wind_direction_10m,is_day,weather_code&wind_speed_unit=kmh&precipitation_unit=mm&forecast_days=1`
            );

            const data = await response.json();
            
            if (data && data.hourly) {
                const hourly = data.hourly;
                
                // Fetch air quality if available
                let aqiData = null;
                try {
                    const aqiResponse = await fetch(
                        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&hourly=us_aqi&forecast_days=1`
                    );
                    aqiData = await aqiResponse.json();
                } catch (e) {
                    // Air quality not available for this location
                }

                // Store forecast data for all 24 hours
                const forecast = [];
                for (let i = 0; i < 24; i++) {
                    forecast.push({
                        temperature: hourly.temperature_2m?.[i] || 20,
                        cloudCover: hourly.cloud_cover?.[i] || 50,
                        windSpeed: hourly.wind_speed_10m?.[i] || 10,
                        precipitation: Math.max(0, hourly.precipitation?.[i] || 0),
                        humidity: hourly.relative_humidity_2m?.[i] || 50,
                        pressure: hourly.surface_pressure?.[i] || 1013,
                        uvIndex: hourly.uv_index?.[i] || 5,
                        visibility: hourly.visibility?.[i] || 10,
                        windDirection: hourly.wind_direction_10m?.[i] || 0,
                        isDay: hourly.is_day?.[i] || 1,
                        weatherCode: hourly.weather_code?.[i] || 0,
                        airQuality: aqiData?.hourly?.us_aqi?.[i] || 50
                    });
                }

                this.forecastData.set(location.id, forecast);
            }
        } catch (error) {
            console.error(`Failed to fetch forecast for ${location.name}:`, error);
        }
    }

    createAuraCard(location) {
        const card = document.createElement('div');
        card.className = 'aura-card';
        card.dataset.locationId = location.id;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'location-name';
        nameDiv.textContent = location.name;

        const auraDiv = document.createElement('div');
        auraDiv.className = 'aura-visualization';
        auraDiv.id = `aura-${location.id}`;

        // Create overlay for detailed view (positioned absolutely over entire card)
        const overlay = document.createElement('div');
        overlay.className = 'aura-overlay';
        overlay.id = `overlay-${location.id}`;

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'inclement-score';
        scoreDiv.innerHTML = '<span class="label">inclement:</span><span class="value" id="score-' + location.id + '">—</span>';

        card.appendChild(nameDiv);
        card.appendChild(auraDiv);
        card.appendChild(scoreDiv);
        card.appendChild(overlay);

        this.gridContainer.appendChild(card);

        // Update aura for current time
        this.updateAuraForLocation(location);
    }

    updateAuraForLocation(location) {
        const forecast = this.forecastData.get(location.id);
        if (!forecast) return;

        const hourIndex = Math.min(this.currentTimeOffset, 23);
        const weather = forecast[hourIndex];

        const auraElement = document.getElementById(`aura-${location.id}`);
        const scoreElement = document.getElementById(`score-${location.id}`);

        if (!auraElement || !weather) return;

        // Calculate aura parameters
        const baseHue = this.getBaseHue(location.lat, location.lon);
        const tempHue = this.adjustTemperatureHue(baseHue, weather.temperature);
        const saturation = this.getAirQualitySaturation(weather.airQuality);
        const windEffect = this.getWindGradientEffect(weather.windSpeed);
        const altitudeIntensity = this.getAltitudeEffect(location.altitude);
        const precipEffect = this.getPrecipitationEffect(weather.precipitation, weather.temperature);

        const params = {
            baseHue,
            tempHue,
            saturation,
            windEffect,
            altitudeIntensity,
            clouds: weather.cloudCover,
            precip: weather.precipitation,
            wind: weather.windSpeed,
            precipEffect,
            weatherData: {
                humidity: weather.humidity,
                pressure: weather.pressure,
                uvIndex: weather.uvIndex,
                visibility: weather.visibility,
                windDirection: weather.windDirection,
                isDay: weather.isDay,
                weatherCode: weather.weatherCode
            }
        };

        // Generate aura
        const auraConfig = this.generateLinearAura(params);

        // Apply aura
        auraElement.style.width = '100%';
        auraElement.style.maxWidth = '180px';
        auraElement.style.background = auraConfig.background;
        auraElement.style.clipPath = auraConfig.clipPath;
        auraElement.style.filter = auraConfig.filter || 'none';
        auraElement.style.boxShadow = auraConfig.boxShadow || 'none';
        
        const baseOpacity = 0.3 + (weather.cloudCover / 100) * 0.7;
        auraElement.style.opacity = baseOpacity;

        // Wind animation
        const baseDuration = Math.max(2 - (weather.windSpeed / 100), 0.8);
        auraElement.style.animation = `pulse ${baseDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`;

        // Calculate and display inclement score
        const inclementScore = this.calculateInclementScore(
            params.weatherData,
            weather.windSpeed,
            weather.precipitation,
            weather.cloudCover
        );
        scoreElement.textContent = inclementScore.score.toFixed(2);

        // Update weather details overlay if in detailed view
        if (this.detailedView) {
            this.updateWeatherDetails(location, weather);
        }
    }

    updateWeatherDetails(location, weather) {
        const overlay = document.getElementById(`overlay-${location.id}`);
        if (!overlay) return;

        const getAirQualityLabel = (aqi) => {
            if (aqi <= 50) return 'Good';
            if (aqi <= 100) return 'Moderate';
            if (aqi <= 150) return 'Unhealthy for Sensitive';
            if (aqi <= 200) return 'Unhealthy';
            if (aqi <= 300) return 'Very Unhealthy';
            return 'Hazardous';
        };

        overlay.innerHTML = `
            <div class="weather-detail-item">
                <span class="label">temperature:</span>
                <span class="value">${Math.round(weather.temperature)}°C</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">wind speed:</span>
                <span class="value">${Math.round(weather.windSpeed)} km/h</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">air quality:</span>
                <span class="value">${getAirQualityLabel(weather.airQuality)} (${weather.airQuality})</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">cloud cover:</span>
                <span class="value">${Math.round(weather.cloudCover)}%</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">precipitation:</span>
                <span class="value">${weather.precipitation.toFixed(1)} mm/h</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">humidity:</span>
                <span class="value">${Math.round(weather.humidity)}%</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">pressure:</span>
                <span class="value">${Math.round(weather.pressure)} hPa</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">uv index:</span>
                <span class="value">${Math.round(weather.uvIndex)}</span>
            </div>
            <div class="weather-detail-item">
                <span class="label">visibility:</span>
                <span class="value">${weather.visibility.toFixed(1)} km</span>
            </div>
        `;
    }

    updateAllWeatherDetails() {
        if (!this.detailedView) return;
        
        this.locations.forEach(location => {
            const forecast = this.forecastData.get(location.id);
            if (!forecast) return;

            const hourIndex = Math.min(this.currentTimeOffset, 23);
            const weather = forecast[hourIndex];
            
            if (weather) {
                this.updateWeatherDetails(location, weather);
            }
        });
    }

    updateAllAuras() {
        this.locations.forEach(location => {
            this.updateAuraForLocation(location);
        });
        
        // Update weather details if in detailed view
        if (this.detailedView) {
            this.updateAllWeatherDetails();
        }
    }

    updateTimeLabel() {
        if (this.currentTimeOffset === 0) {
            this.timeLabel.textContent = 'Current Time';
        } else {
            this.timeLabel.textContent = `In ${this.currentTimeOffset} hour${this.currentTimeOffset !== 1 ? 's' : ''}`;
        }
    }

    async refreshAll() {
        // Stop auto-play if running
        if (this.isPlaying) {
            this.stopAutoPlay();
            this.isPlaying = false;
            this.playPauseBtn.classList.remove('playing');
        }
        
        this.refreshBtn.disabled = true;
        
        // Clear existing forecast data (but keep locations and used places)
        this.forecastData.clear();
        
        // Re-fetch forecast for all locations in batches
        const batchSize = 10;
        for (let i = 0; i < this.locations.length; i += batchSize) {
            const batch = this.locations.slice(i, i + batchSize);
            await Promise.all(batch.map(location => this.fetchForecastData(location)));
        }
        
        // Update all auras
        this.updateAllAuras();
        
        this.refreshBtn.disabled = false;
    }

    // Helper methods for aura generation (from now.js)
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

    // Calculate inclement weather score (from script.js)
    calculateInclementScore(weatherData, windSpeed, precipitation, cloudCover) {
        let score = 0;
        const factors = [];
        
        // Weather code severity (WMO codes)
        const weatherCode = weatherData?.weatherCode || 0;
        let weatherCodeScore = 0;
        let weatherType = 'normal';
        
        // Thunderstorms (most severe)
        if (weatherCode >= 95 && weatherCode <= 99) {
            weatherCodeScore = 0.9 + ((weatherCode - 95) / 4) * 0.1;
            weatherType = 'thunderstorm';
        }
        // Heavy snow
        else if (weatherCode >= 71 && weatherCode <= 77) {
            weatherCodeScore = 0.6 + ((weatherCode - 71) / 6) * 0.2;
            weatherType = 'heavy_snow';
        }
        // Heavy rain
        else if (weatherCode >= 61 && weatherCode <= 67) {
            weatherCodeScore = 0.5 + ((weatherCode - 61) / 6) * 0.2;
            weatherType = 'heavy_rain';
        }
        // Showers (moderate)
        else if (weatherCode >= 80 && weatherCode <= 86) {
            weatherCodeScore = 0.3 + ((weatherCode - 80) / 6) * 0.2;
            weatherType = 'showers';
        }
        // Light precipitation
        else if (weatherCode >= 51 && weatherCode <= 57) {
            weatherCodeScore = 0.15 + ((weatherCode - 51) / 6) * 0.1;
            weatherType = 'light_precip';
        }
        // Fog (reduces visibility)
        else if (weatherCode >= 45 && weatherCode <= 49) {
            weatherCodeScore = 0.2;
            weatherType = 'fog';
        }
        
        factors.push({ name: 'weatherCode', value: weatherCodeScore, weight: 0.4 });
        
        // Wind speed contribution
        const wind = parseFloat(windSpeed) || 0;
        let windScore = 0;
        if (wind > 80) {
            windScore = 0.7 + Math.min(0.3, (wind - 80) / 100);
        } else if (wind > 50) {
            windScore = 0.5 + ((wind - 50) / 30) * 0.2;
        } else if (wind > 30) {
            windScore = 0.3 + ((wind - 30) / 20) * 0.2;
        } else if (wind > 15) {
            windScore = 0.1 + ((wind - 15) / 15) * 0.2;
        } else {
            windScore = wind / 15 * 0.1;
        }
        
        if (windScore > 0.6 && weatherType === 'normal') {
            weatherType = 'high_wind';
        }
        factors.push({ name: 'wind', value: windScore, weight: 0.25 });
        
        // Precipitation intensity contribution
        const precip = parseFloat(precipitation) || 0;
        let precipScore = 0;
        if (precip > 10) {
            precipScore = 0.7 + Math.min(0.3, (precip - 10) / 20);
        } else if (precip > 5) {
            precipScore = 0.5 + ((precip - 5) / 5) * 0.2;
        } else if (precip > 2) {
            precipScore = 0.3 + ((precip - 2) / 3) * 0.2;
        } else if (precip > 0.5) {
            precipScore = 0.1 + ((precip - 0.5) / 1.5) * 0.2;
        } else {
            precipScore = precip / 0.5 * 0.1;
        }
        factors.push({ name: 'precipitation', value: precipScore, weight: 0.2 });
        
        // Visibility contribution
        const visibility = weatherData?.visibility || 10;
        let visibilityScore = 0;
        if (visibility < 1) {
            visibilityScore = 0.5;
        } else if (visibility < 3) {
            visibilityScore = 0.3;
        } else if (visibility < 5) {
            visibilityScore = 0.15;
        }
        factors.push({ name: 'visibility', value: visibilityScore, weight: 0.1 });
        
        // Cloud cover contribution
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
        score = score / totalWeight;
        
        // Ensure score is between 0 and 1
        score = Math.max(0, Math.min(1, score));
        
        return {
            score: score,
            weatherType: weatherType,
            factors: factors
        };
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
    new WeatherAuraGrid();
});

