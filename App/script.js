const ws = new WebSocket('ws://localhost:8080');

let map;
let userLocation;
let directionsService;
let directionsRenderer;
let service;

ws.addEventListener('open', function () {
    console.log('Connected to WebSocket server');
});

ws.addEventListener('message', function (event) {
    const data = JSON.parse(event.data);
    if (data.type === 'clientsCount') {
        console.log('Total connected clients:', data.count);
    }
});

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

function searchFoods() {
    const searchInput = document.getElementById('foodInput').value;

    if (searchInput.trim() === "") {
        document.getElementById('foodResults').innerHTML = "";
        return;
    }

    fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${searchInput}&api_key=GA1gb4Utg0PxONFsBT7v7qsIMqyskXOZU1NjUxSS`)
        .then(response => response.json())
        .then(data => {
            const foodResultsDiv = document.getElementById('foodResults');
            foodResultsDiv.innerHTML = '';

            if (data.foods.length === 0) {
                foodResultsDiv.textContent = 'No results found';
            } else {
                const displayedFoods = data.foods.slice(0, 5);
                displayedFoods.forEach(food => {
                    const foodContainer = document.createElement('div');
                    foodContainer.classList.add('healthy-food-container');

                    const vitaminCInfo = food.foodNutrients.find(nutrient => nutrient.nutrientName === 'Vitamin C, total ascorbic acid');
                    const vitaminC = vitaminCInfo ? vitaminCInfo.value : 0;
                    const vitaminAInfo = food.foodNutrients.find(nutrient => nutrient.nutrientName === 'Vitamin A, RAE');
                    const vitaminA = vitaminAInfo ? vitaminAInfo.value : 0;

                    foodContainer.textContent = `${food.description} - Vitamin C: ${vitaminC} mg, Vitamin A: ${vitaminA} µg`;
                    foodContainer.style.cursor = 'pointer';

                    foodContainer.addEventListener('click', () => {
                        if (vitaminC === 0 && vitaminA === 0) {
                            alert("Vitamin information not available for this food.");
                            return;
                        }

                        const selectedFoodData = {
                            description: food.description,
                            vitaminC: vitaminC,
                            vitaminA: vitaminA
                        };

                        console.log('Selected food:', selectedFoodData.description);
                        ws.send(selectedFoodData.description);

                        addToSelectedFoodsList(selectedFoodData);
                    });

                    foodResultsDiv.appendChild(foodContainer);
                });
            }
        })
        .catch(error => console.error('Error fetching data:', error));
}

const searchInput = document.getElementById('foodInput');
searchInput.addEventListener('input', debounce(searchFoods, 500));

function initMap(latitude = 37.7749, longitude = -122.4194) {
    userLocation = { lat: latitude, lng: longitude };
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: userLocation
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: '#FF0000'
        }
    });

    new google.maps.Marker({
        position: userLocation,
        map: map,
        title: 'You are here'
    });

    service = new google.maps.places.PlacesService(map);
}

function createMarker(place) {
    const placeLoc = place.geometry.location;
    const marker = new google.maps.Marker({
        map: map,
        position: placeLoc
    });

    google.maps.event.addListener(marker, 'click', function() {
        service.getDetails({ placeId: place.place_id }, function(details, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                const infowindowContent = `
                    <div><strong>${details.name}</strong><br>
                    ${details.photos ? `<img src="${details.photos[0].getUrl()}" alt="Market Image" style="width:100px;height:100px;"><br>` : ''}
                    Rating: ${details.rating ? details.rating : 'No ratings'}<br>
                    ${details.opening_hours ? 'Open now: ' + (details.opening_hours.isOpen() ? 'Yes' : 'No') : 'No opening hours'}<br>
                    Address: ${details.formatted_address}<br>
                    <button onclick="getDirections(${placeLoc.lat()}, ${placeLoc.lng()})">Get Directions</button></div>
                `;
                const infowindow = new google.maps.InfoWindow({
                    content: infowindowContent
                });
                infowindow.open(map, marker);
            } else {
                alert('Failed to get place details: ' + status);
            }
        });
    });
}

function getDirections(lat, lng) {
    const destination = { lat: lat, lng: lng };
    const request = {
        origin: userLocation,
        destination: destination,
        travelMode: 'DRIVING'
    };
    directionsService.route(request, function(result, status) {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            alert('Directions request failed due to ' + status);
        }
    });
}

function addToSelectedFoodsList(selectedFoodData) {
    const selectedFoodsList = document.getElementById('selectedFoodsList');
    const listItem = document.createElement('div');
    listItem.classList.add('selected-food-item');

    const description = document.createElement('div');
    description.classList.add('selected-food-description');
    description.textContent = `Description: ${selectedFoodData.description}`;

    const vitamins = document.createElement('div');
    vitamins.classList.add('selected-food-vitamins');
    vitamins.textContent = `Vitamin C: ${selectedFoodData.vitaminC} mg, Vitamin A: ${selectedFoodData.vitaminA} µg`;

    listItem.appendChild(description);
    listItem.appendChild(vitamins);

    selectedFoodsList.appendChild(listItem);
}

document.getElementById('locate-market').addEventListener('click', function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const request = {
                location: { lat: position.coords.latitude, lng: position.coords.longitude },
                radius: '5000', 
                type: ['grocery_or_supermarket']
            };

            service.nearbySearch(request, function(results, status) {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    for (let i = 0; i < results.length; i++) {
                        createMarker(results[i]);
                    }
                } else {
                    console.error('Error: ' + status);
                    alert('Error: ' + status);
                }
            });

            console.log('Latitude:', position.coords.latitude);
            console.log('Longitude:', position.coords.longitude);
            
            const message = JSON.stringify({ type: 'Locates Nearest Market Availables' });
            ws.send(message);

        }, function(error) {
            alert('Error: The Geolocation service failed. ' + error.message);
        });
    } else {
        alert('Error: Your browser doesn\'t support geolocation.');
    }
});

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
        initMap(position.coords.latitude, position.coords.longitude);
    }, function(error) {
        alert('Error: The Geolocation service failed. ' + error.message);
        initMap();
    });
} else {
    alert('Error: Your browser doesn\'t support geolocation.');
    initMap(); 
}
