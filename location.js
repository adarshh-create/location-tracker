class LiveLocationTracker {
            constructor() {
                this.canvas = document.getElementById('locationCanvas');
                this.ctx = this.canvas.getContext('2d');
                this.statusElement = document.getElementById('status');
                
                this.currentLocation = null;
                this.cansatLocation = null;
                this.locationHistory = [];
                this.watchId = null;
                this.isTracking = false;
                this.hasArrived = false;
                this.arrivalThreshold = 10; 
                
                this.gridSize = 50;
                this.scale = 50; 
                this.centerX = this.canvas.width / 2;
                this.centerY = this.canvas.height / 2;
                
                this.lastPosition = null;
                this.lastTime = null;
                
                this.init();
            }
            
            init() {
                this.drawGrid();
                this.setupEventListeners();
                this.updateTrackingStatus('Stopped', false);
            }
            
            setupEventListeners() {
                document.getElementById('setTarget').addEventListener('click', () => {
                    this.setTargetAndStartTracking();
                });
                
                document.getElementById('stopTracking').addEventListener('click', () => {
                    this.stopTracking();
                });
                
                document.getElementById('clearAll').addEventListener('click', () => {
                    this.clearAllAndReset();
                });
                
                document.getElementById('cansatLat').addEventListener('input', () => {
                    this.validateTarget();
                });
                
                document.getElementById('cansatLon').addEventListener('input', () => {
                    this.validateTarget();
                });
            }
            
            validateTarget() {
                const lat = parseFloat(document.getElementById('cansatLat').value);
                const lon = parseFloat(document.getElementById('cansatLon').value);
                
                if (!isNaN(lat) && !isNaN(lon) && 
                    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    this.cansatLocation = { lat, lon };
                    this.updateCanSatLocationDisplay();
                    if (!this.isTracking) {
                        this.redrawCanvas();
                    }
                }
            }
            
            setTargetAndStartTracking() {
                const lat = parseFloat(document.getElementById('cansatLat').value);
                const lon = parseFloat(document.getElementById('cansatLon').value);
                
                if (isNaN(lat) || isNaN(lon)) {
                    this.updateStatus('Please enter valid coordinates', 'error');
                    return;
                }
                
                if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    this.updateStatus('Coordinates out of valid range', 'error');
                    return;
                }
                
                this.cansatLocation = { lat, lon };
                this.updateCanSatLocationDisplay();
                this.startLiveTracking();
            }
            
            startLiveTracking() {
                if (!navigator.geolocation) {
                    this.updateStatus('Geolocation not supported by browser', 'error');
                    return;
                }
                
                this.updateStatus('Starting live tracking...', 'tracking');
                this.hasArrived = false;
                this.locationHistory = [];
                
                const options = {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                };
                
                this.watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        this.handleLocationUpdate(position);
                    },
                    (error) => {
                        this.handleLocationError(error);
                    },
                    options
                );
                
                this.isTracking = true;
                this.updateTrackingStatus('Active', true);
                document.getElementById('setTarget').style.display = 'none';
                document.getElementById('stopTracking').style.display = 'block';
            }
            
            handleLocationUpdate(position) {
                const newLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                if (this.lastPosition && this.lastTime) {
                    const distance = this.haversineDistance(this.lastPosition, newLocation);
                    const timeElapsed = (position.timestamp - this.lastTime) / 1000; 
                    const speed = timeElapsed > 0 ? (distance / timeElapsed) * 3.6 : 0; 
                    document.getElementById('speedValue').textContent = speed.toFixed(1);
                }
                
                this.currentLocation = newLocation;
                this.lastPosition = newLocation;
                this.lastTime = position.timestamp;
                
                this.locationHistory.push({...newLocation});
                if (this.locationHistory.length > 50) {
                    this.locationHistory.shift();
                }
                
                this.updateCurrentLocationDisplay();
                this.updateAccuracy(position.coords.accuracy);
                this.redrawCanvas();
                
                if (this.cansatLocation) {
                    this.calculateDistance();
                    this.updateNavigation();
                    this.checkArrival();
                }
                
                this.updateStatus('Live tracking active - Moving...', 'tracking');
            }
            
            handleLocationError(error) {
                let errorMessage = 'Location error: ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Position unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Request timeout';
                        break;
                    default:
                        errorMessage += 'Unknown error';
                }
                this.updateStatus(errorMessage, 'error');
            }
            
            checkArrival() {
                if (!this.currentLocation || !this.cansatLocation || this.hasArrived) return;
                
                const distance = this.haversineDistance(this.currentLocation, this.cansatLocation);
                
                if (distance <= this.arrivalThreshold) {
                    this.hasArrived = true;
                    this.showArrival();
                    this.updateStatus('🎉 You have reached the  location! 🎉', 'arrived');
                    
                }
            }
            
            showArrival() {
                document.getElementById('arrivalDisplay').style.display = 'block';
                document.getElementById('navigationDisplay').style.display = 'none';
                
                setTimeout(() => {
                    document.getElementById('arrivalDisplay').style.animation = 'celebration 2s ease-in-out';
                }, 100);
            }
            
            updateNavigation() {
                if (!this.currentLocation || !this.cansatLocation || this.hasArrived) return;
                
                const bearing = this.calculateBearing(this.currentLocation, this.cansatLocation);
                const direction = this.getDirectionFromBearing(bearing);
                const arrow = this.getArrowFromBearing(bearing);
                
                document.getElementById('directionArrow').textContent = arrow;
                document.getElementById('directionText').textContent = `Head ${direction}`;
                document.getElementById('navigationDisplay').style.display = 'block';
            }
            
            calculateBearing(pos1, pos2) {
                const lat1 = pos1.lat * Math.PI / 180;
                const lat2 = pos2.lat * Math.PI / 180;
                const deltaLon = (pos2.lon - pos1.lon) * Math.PI / 180;
                
                const y = Math.sin(deltaLon) * Math.cos(lat2);
                const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
                
                const bearing = Math.atan2(y, x) * 180 / Math.PI;
                return (bearing + 360) % 360;
            }
            
            getDirectionFromBearing(bearing) {
                const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
                const index = Math.round(bearing / 22.5) % 16;
                return directions[index];
            }
            
            getArrowFromBearing(bearing) {
                const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
                const index = Math.round(bearing / 45) % 8;
                return arrows[index];
            }
            
            stopTracking() {
                if (this.watchId !== null) {
                    navigator.geolocation.clearWatch(this.watchId);
                    this.watchId = null;
                }
                
                this.isTracking = false;
                this.updateTrackingStatus('Stopped', false);
                this.updateStatus('Tracking stopped', 'success');
                
                document.getElementById('setTarget').style.display = 'block';
                document.getElementById('stopTracking').style.display = 'none';
            }
            
            clearAllAndReset() {
                this.stopTracking();
                
                this.currentLocation = null;
                this.cansatLocation = null;
                this.locationHistory = [];
                this.hasArrived = false;
                this.lastPosition = null;
                this.lastTime = null;
                
                document.getElementById('cansatLat').value = '';
                document.getElementById('cansatLon').value = '';
                
                document.getElementById('currentLocationDisplay').style.display = 'none';
                document.getElementById('cansatLocationDisplay').style.display = 'none';
                document.getElementById('distanceDisplay').style.display = 'none';
                document.getElementById('navigationDisplay').style.display = 'none';
                document.getElementById('arrivalDisplay').style.display = 'none';
                
                document.getElementById('speedValue').textContent = '--';
                document.getElementById('accuracyValue').textContent = '--';
                
                this.redrawCanvas();
                this.updateStatus('All data cleared - Ready to start', 'success');
            }
            
            drawGrid() {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.ctx.strokeStyle = '#e2e8f0';
                this.ctx.lineWidth = 1;
                
                for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.canvas.height);
                    this.ctx.stroke();
                }
                
                for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.canvas.width, y);
                    this.ctx.stroke();
                }
                
                this.ctx.strokeStyle = '#cbd5e0';
                this.ctx.lineWidth = 2;
                
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerX, 0);
                this.ctx.lineTo(this.centerX, this.canvas.height);
                this.ctx.stroke();
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, this.centerY);
                this.ctx.lineTo(this.canvas.width, this.centerY);
                this.ctx.stroke();
                
                this.drawCoordinateLabels();
            }
            
            drawCoordinateLabels() {
                this.ctx.fillStyle = '#718096';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                
                const maxGrids = Math.floor(this.canvas.width / this.gridSize / 2);
                
                for (let i = -maxGrids; i <= maxGrids; i++) {
                    if (i === 0) continue;
                    
                    const x = this.centerX + (i * this.gridSize);
                    const distance = Math.abs(i * this.scale);
                    
                    if (x > 0 && x < this.canvas.width) {
                        this.ctx.fillText(`${distance}m`, x, this.centerY - 5);
                    }
                }
                
                this.ctx.textAlign = 'left';
                for (let i = -maxGrids; i <= maxGrids; i++) {
                    if (i === 0) continue;
                    
                    const y = this.centerY + (i * this.gridSize);
                    const distance = Math.abs(i * this.scale);
                    
                    if (y > 10 && y < this.canvas.height) {
                        this.ctx.fillText(`${distance}m`, this.centerX + 5, y + 3);
                    }
                }
            }
            
            redrawCanvas() {
                this.drawGrid();
                
                if (this.locationHistory.length > 1) {
                    this.drawPathTrail();
                }
                if (this.cansatLocation) {
                    const referencePoint = this.currentLocation || this.cansatLocation;
                    this.drawLocation(this.cansatLocation, '#e53e3e', 'CanSat', referencePoint, 'target');
                }
                
                if (this.currentLocation) {
                    this.drawLocation(this.currentLocation, '#3182ce', 'You', this.currentLocation, 'current');
                }
                
                if (this.currentLocation && this.cansatLocation && !this.hasArrived) {
                    this.drawConnectionLine();
                }
                
                if (this.hasArrived && this.currentLocation) {
                    this.drawArrivalIndicator();
                }
            }
            
            drawPathTrail() {
                if (this.locationHistory.length < 2 || !this.currentLocation) return;
                
                this.ctx.strokeStyle = '#9f7aea';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([]);
                
                this.ctx.beginPath();
                
                for (let i = 0; i < this.locationHistory.length; i++) {
                    const coords = this.latLonToCanvas(this.locationHistory[i], this.currentLocation);
                    
                    if (i === 0) {
                        this.ctx.moveTo(coords.x, coords.y);
                    } else {
                        this.ctx.lineTo(coords.x, coords.y);
                    }
                }
                
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#9f7aea';
                for (let i = 0; i < this.locationHistory.length; i += 5) {
                    const coords = this.latLonToCanvas(this.locationHistory[i], this.currentLocation);
                    this.ctx.beginPath();
                    this.ctx.arc(coords.x, coords.y, 2, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
            }
            
            drawLocation(location, color, label, referencePoint, type) {
                const coords = this.latLonToCanvas(location, referencePoint);
                
                if (type === 'current') {
                    if (this.currentLocation.accuracy) {
                        const accuracyRadius = (this.currentLocation.accuracy / this.scale) * this.gridSize;
                        this.ctx.strokeStyle = color;
                        this.ctx.lineWidth = 1;
                        this.ctx.setLineDash([3, 3]);
                        this.ctx.beginPath();
                        this.ctx.arc(coords.x, coords.y, Math.min(accuracyRadius, 100), 0, 2 * Math.PI);
                        this.ctx.stroke();
                        this.ctx.setLineDash([]);
                    }
                    
                    const time = Date.now() / 1000;
                    const pulseSize = 12 + Math.sin(time * 3) * 3;
                    
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(coords.x, coords.y, pulseSize, 0, 2 * Math.PI);
                    this.ctx.fill();
                } else {
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(coords.x, coords.y, 10, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
                
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([]);
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#2d3748';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(label, coords.x, coords.y - 20);
                
                if (type === 'target') {
                    this.ctx.font = '10px Arial';
                    this.ctx.fillStyle = '#718096';
                    this.ctx.fillText(`${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`, coords.x, coords.y + 25);
                }
            }
            
            drawConnectionLine() {
                const currentCoords = this.latLonToCanvas(this.currentLocation, this.currentLocation);
                const cansatCoords = this.latLonToCanvas(this.cansatLocation, this.currentLocation);
                
                this.ctx.strokeStyle = '#667eea';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([8, 4]);
                
                this.ctx.beginPath();
                this.ctx.moveTo(currentCoords.x, currentCoords.y);
                this.ctx.lineTo(cansatCoords.x, cansatCoords.y);
                this.ctx.stroke();
                
                this.ctx.setLineDash([]);
            }
            
            drawArrivalIndicator() {
                const coords = this.latLonToCanvas(this.currentLocation, this.currentLocation);
                
                const time = Date.now() / 1000;
                const radius = 30 + Math.sin(time * 2) * 10;
                
                this.ctx.strokeStyle = '#48bb78';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([]);
                this.ctx.beginPath();
                this.ctx.arc(coords.x, coords.y, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#48bb78';
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('✓', coords.x, coords.y + 7);
            }
            
            latLonToCanvas(location, referencePoint) {
                const latDiff = location.lat - referencePoint.lat;
                const lonDiff = location.lon - referencePoint.lon;
                
                const metersPerDegLat = 111000;
                const metersPerDegLon = 111000 * Math.cos(referencePoint.lat * Math.PI / 180);
                
                const meterX = lonDiff * metersPerDegLon;
                const meterY = latDiff * metersPerDegLat;
                
                const pixelX = this.centerX + (meterX / this.scale * this.gridSize);
                const pixelY = this.centerY - (meterY / this.scale * this.gridSize);
                
                return { x: pixelX, y: pixelY };
            }
            
            calculateDistance() {
                if (!this.currentLocation || !this.cansatLocation) {
                    document.getElementById('distanceDisplay').style.display = 'none';
                    return;
                }
                
                const distance = this.haversineDistance(this.currentLocation, this.cansatLocation);
                
                document.getElementById('distanceValue').textContent = distance.toFixed(1);
                document.getElementById('distanceDisplay').style.display = 'block';
            }
            
            haversineDistance(pos1, pos2) {
                const R = 6371000; 
                const lat1Rad = pos1.lat * Math.PI / 180;
                const lat2Rad = pos2.lat * Math.PI / 180;
                const deltaLatRad = (pos2.lat - pos1.lat) * Math.PI / 180;
                const deltaLonRad = (pos2.lon - pos1.lon) * Math.PI / 180;
                
                const a = Math.sin(deltaLatRad / 2) ** 2 +
                          Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                          Math.sin(deltaLonRad / 2) ** 2;
                
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                
                return R * c;
            }
            
            updateCurrentLocationDisplay() {
                if (this.currentLocation) {
                    document.getElementById('currentLat').textContent = this.currentLocation.lat.toFixed(6);
                    document.getElementById('currentLon').textContent = this.currentLocation.lon.toFixed(6);
                    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                    document.getElementById('currentLocationDisplay').style.display = 'block';
                }
            }
            
            updateCanSatLocationDisplay() {
                if (this.cansatLocation) {
                    document.getElementById('cansatLatDisplay').textContent = this.cansatLocation.lat.toFixed(6);
                    document.getElementById('cansatLonDisplay').textContent = this.cansatLocation.lon.toFixed(6);
                    document.getElementById('cansatLocationDisplay').style.display = 'block';
                }
            }
            
            updateAccuracy(accuracy) {
                document.getElementById('accuracyValue').textContent = accuracy ? accuracy.toFixed(0) : '--';
            }
            
            updateTrackingStatus(status, isActive) {
                document.getElementById('trackingStatus').textContent = status;
                const dot = document.getElementById('trackingDot');
                
                if (isActive) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            }
            
            updateStatus(message, type = '') {
                this.statusElement.textContent = message;
                this.statusElement.className = `status ${type}`;
            }
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            const tracker = new LiveLocationTracker();
            
            function animate() {
                if (tracker.isTracking && tracker.currentLocation) {
                    tracker.redrawCanvas();
                }
                requestAnimationFrame(animate);
            }
            animate();
        });