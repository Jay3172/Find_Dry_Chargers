$(document).foundation()

/* The global object which holds the charger locations
 * and the weather at each.  This data is held in local
 * storage so we don't lose it when the program restarts.
 * This data is accumulated by the API calls.  We use it
 * to avoid excessive use of the APIs.
 * 
 * The version number is used to reject data from an old
 * version of the program.  Change it when we change the
 * format of the data in local storage.
 */
const local_storage_version = 2;
let global_storage = null;

/* Fetch our global storage from local storage.  If there is no local storage,
 * or if it was written by the wrong version of the pgogram, reject it.  */
const global_storage_string = localStorage.getItem("find_dry_chargers");
if (global_storage_string != null) {
    global_storage = JSON.parse(global_storage_string);
    if ("version" in global_storage) {
        if (global_storage.version != local_storage_version) {
            global_storage = null;
        }
    }
} else {
    global_storage = null;
};
if (global_storage == null) {
    global_storage = {
        locations: {},
        version: local_storage_version
    }
}


/* This global remembers the function that is to be called by
 * populate_global_storage when it is done.  */
let completion_function = null;

/* To simplify the process of looping through the charger locations
 * and filling in their weather, we have a global which rememebrs
 * which charger location we are working on now.  */
let charger_location = null;

/* This is an obscured form of the API keys, used to avoid
 * putting the API keys into the source code in plain text.
 */
const obscured_API_keys = "U2FsdGVkX19V//ZyFekiRotbw+8m6f7ZSo9OsIqIFY43zSANNHBZ27QmbBNjhILvpfe1uorVhl9GTs5CsoZQr8KmTyXoVO2I4n6nLQzMTlIENgcBWpP35z476/fGfF5Y8RYoNUqni8QNZznltNw1WNd54V5FnCghWKJDPVMckH7ggvQhUZel/twRtitZhZKikwdCHI1cUpSkp9liExGIA/JMj5UxoHNAkM8XEZnYZK5ya1MET8WCRhjk4KDvbfW5ACPFoidMvcot+tjb2uM7qstRMcZfFUhIokH8G29QmKGMVUiaVQumEbnGWxeda5eMBQW10SL4/7kCgDyxQzohM9lJ1F7ezBWeLrT8Q1oQte0c57OtsXQpyuhuXs+p9pAh5iHD9GfNveKkXuWtQJJr5s+kaWrsIzjxCIZPbWtjGaPkZPJtcoLrtjlTDYpjAmFCrJQwG4JGTXyfoNrSWdNq3SfWnrSmSWbrnIB2rdkeFvCE68lXrUDhsc/qA/V3ww7h3CzCfoir+nTbgP4I9ODEdOQzy6uaPSqLnaIeLRcddeJPiQsqAAJYNbQGTrTgCHZBpOf52flcTO82ZWIXMJ9KJjKQx1M1sZj7lFo8++iGLd53umPB/wAcQxdJpk2qH7V6mtjGbS7/PHGxJW15ZSn3R8Xnn1D1e+9mqTY/IO8Efc49iwWJehK3erUZlQRRBVOUfl5pE+DHw5BQKRB/9EIZezCBzXjgMIZrrhx0CN6lsLkuWVK86VguYeubGiwc7xgpMvbauP797vHEWgAr9KHW9QhaKl1b3N36mbrHHS0oOq2ZDg+bNc1tgbBwWZH5oZoOWLgo1gzje1lOzqf6MvNvhKlXHk26iCCndWujRJ974eWSZ/Y81f1GjiIB3+Ww2VruohAjoCkb9RyDOwFZy4WYjjmzpLqQuE4x62VrJS6Af4krYAGn9Jq6eiNezFcBBdcV795bXdLd09i+mkKCz0U7cYAuiJe8y2jtDVpBjxmj7Ee36NgZiw6YNWpMSgpg12y0dT6ZqEqC5XPRcgF1E5VGlA==";

// The following string is used to obfuscate and encrypt the credentials
const saltCredentials = "abjf02heg9u64a{%m<83#@;Pxrjg17uyr#@&*%^Y";

/* Reveal the credentials.  API_keys is an object with two properties:
 * Open_Charge_Map_API_key and Open_Weather_API_key.  The values of
 * these properties are the respective API keys.
 */
const API_keys = decodeCredentials(obscured_API_keys);

const open_charge_map_API_key = API_keys.open_charge_map_API_key;
const open_weather_API_key = API_keys.open_weather_API_key;

/* Function to populate the global data structure with charger
 * locations and the weather at each, given a location and distance.
 * This function is asynchronous, so the caller must exit after
 * calling it, and it will call the third parameter when it
 * is done.
 * The first parameter is the location, expressed as an array
 * of two floating-point numbers: the latitude and longitude.
 * The second parameter is the function that is called when
 * the population of global storage is complete.
 * The third parameter is local data which is passed to the
 * completion function.
 */
function populate_global_storage(location, completion,
    local_data) {
    /* We remember the completion function in a global.  */
    completion_function = completion;

    const latitude = location[0];
    const longitude = location[1];
    const maximum_distance = local_data.maximum_distance;

    /* Ask only for locations with connection types that the user wants.  */
    let connection_types = "";
    if (local_data.Tesla) {
        connection_types = "30,31,8,27";
    }
    if (local_data.CCS) {
        if (connection_types != "") {
            connection_types = connection_types + ",";
        }
        connection_types = connection_types + "32,33";
    }
    if (local_data.CHAdeMO) {
        if (connection_types != "") {
            connection_types = connection_types + ",";
        }
        connection_types = connection_types + "2";
    }

    /* Use the Open Charge Map API to get a list of nearby chargers.  */
    let the_URL = "https://api.openchargemap.io/v3/poi/?output=json&countrycode=us";
    the_URL = the_URL + "&maxresults=10"; /* 10 for debugging, 100 for production.  */
    the_URL = the_URL + "&key=" + open_charge_map_API_key;
    the_URL = the_URL + "&latitude=" + latitude;
    the_URL = the_URL + "&longitude=" + longitude;
    the_URL = the_URL + "&distance=" + maximum_distance;
    the_URL = the_URL + "&connectiontypeid=" + connection_types;
    the_URL = the_URL + "&levelid=3";
    fetch(the_URL)
        .then(function (response) { return response.json() })
        .then(function (data) {
            process_charger_pois(data,
                local_data)
        });
}

/* Function to process the charger points of interest. 
 * Each point of interest is placed in global storage
 * so we can fetch its weather later.
 */

function process_charger_pois(data, local_data) {
    for (let i = 0; i < data.length; i++) {

        /* We remember the chargers by their unique IDs.  */
        const location_string = data[i].UUID;

        /* Place the charger information in global storage so we can attach
         * weather information to it later.  If it is already
         * in global storage it may already have weather
         * information.  */
        if (location_string in global_storage.locations) {
            global_storage.locations[location_string].charger_data = data[i];
        } else {
            global_storage.locations[location_string] = {
                "charger_data": data[i]
            }
        }
    }

    /* Fill in the weather information for each charger location
     * that does not already have its weather but needs it.  If the weather
     * information is more than two hours old, refresh it.
     */
    for (charger_location in global_storage.locations) {
        const this_location = global_storage.locations[charger_location];
        let needs_weather = false;
        if ("weather" in this_location) {
            const last_update_date = new Date(this_location.updated_date);
            const current_date = new Date();
            const seconds_since_last_update = (current_date - last_update_date) / 1000;
            if (seconds_since_last_update > (2 * 60 * 60)) {
                needs_weather = true;
            }
        } else {
            needs_weather = true;
        }

        /* If we aren't going to show the location, we don't need to update
         * its weather.  */
        if (!(is_suitable(this_location, local_data))) {
            needs_weather = false;
        }

        /* If this location needs its weather data updated, update it.  */
        if (needs_weather) {
            const charger_location_data =
                global_storage.locations[charger_location].charger_data;
            const charger_latitude = charger_location_data.AddressInfo.Latitude;
            const charger_longitude = charger_location_data.AddressInfo.Longitude;
            const URL_start = "https://api.openweathermap.org/data/2.5/onecall";
            const the_URL = URL_start +
                "?lat=" + encodeURIComponent(charger_latitude) +
                "&lon=" + encodeURIComponent(charger_longitude) +
                "&appid=" + encodeURIComponent(open_weather_API_key);
            fetch(the_URL)
                .then(function (response) { return response.json() })
                .then(function (weather_data) {
                    process_weather_data(weather_data, local_data)
                }
                )
            /* Because this is an asynchronous process and Javascript
             * is single-thread, we cannot continue around the loop
             * processing all the charger locations.  Instead we must
             * exit from JavaScript and wait for the asynchronous process
             * to complete.  That completion will call process_weather_data,
             * which will restart this loop.  By storing the weather
             * in global data we are assured that this process will
             * complete when all charger locations have their weather.
             */
            return;
        }
    }
    /* If we get here there are no charger locations that need
     * their weather data fetched, so we can proceed with
     * filtering and displaying the information.  */
    completion_function(local_data);
}

/* Function to process weather information for a charger location.
 * We place it in global storage for later display, and so we
 * won't fetch it again.  The location object of the current charger 
 * is remembered in the global variable charger_location.  */
function process_weather_data(weather_data, local_data) {
    const this_location = global_storage.locations[charger_location];
    this_location.weather = weather_data;
    const updated_date = new Date();
    this_location.updated_date = updated_date.toISOString();

    /* Now we must process the remaining charger locations that need but
     * do not have their weather information.  We come back here
     * when each asynchronous operation completes.  When no more locations
     * need weather but do not have it we can proceed.  */
    for (charger_location in global_storage.locations) {
        const this_location = global_storage.locations[charger_location];
        let needs_weather = false;
        if ("weather" in this_location) {
            const last_update_date = new Date(this_location.updated_date);
            const current_date = new Date();
            const seconds_since_last_update = (current_date - last_update_date) / 1000;
            if (seconds_since_last_update > (2 * 60 * 60)) {
                needs_weather = true;
            }
        } else {
            needs_weather = true;
        }

        /* If we aren't going to show the location, we don't need to update
         * its weather.  */
        if (!(is_suitable(this_location, local_data))) {
            needs_weather = false;
        }

        /* If this location needs its weather data updated, update it.  */
        if (needs_weather) {
            const charger_location_data =
                global_storage.locations[charger_location].charger_data;
            const charger_latitude = charger_location_data.AddressInfo.Latitude;
            const charger_longitude = charger_location_data.AddressInfo.Longitude;
            const URL_start = "https://api.openweathermap.org/data/2.5/onecall";
            const the_URL = URL_start +
                "?lat=" + encodeURIComponent(charger_latitude) +
                "&lon=" + encodeURIComponent(charger_longitude) +
                "&appid=" + encodeURIComponent(open_weather_API_key);
            fetch(the_URL)
                .then(function (response) { return response.json() })
                .then(function (new_weather_data) {
                    process_weather_data(new_weather_data,
                        local_data);
                }
                )
            /* Because this is an asynchronous process and Javascript
             * is single-thread, we cannot continue around the loop
             * processing all the charger locations.  Instead we must
             * exit from JavaScript and wait for the asynchronous process
             * to complete.  That completion will call process_weather_data,
             * which will restart this loop.  By storing the weather
             * in global data we are assured that this process will
             * complete when all charger locations have their weather.
             */
            return;
        }
    }

    /* All of the charger locations that we will display have weather information.
     * Now we can filter and display the results.  */
    completion_function(local_data);
}

/* Function to display the charger data, 
 * including weather information.
 * Local_data is an object containing data gathered
 * from the form.
 */
function display_charger_data(local_data) {

    /* Remember the data we have gathered for a later run of this
     * application.  */
    localStorage.setItem("find_dry_chargers",
        JSON.stringify(global_storage));
    const locations = global_storage.locations;

    let div = document.getElementById("resultsList");
    /* Make sure there is nothing left over from the last display.
     */
    div.removeChild(div.firstChild);

    let ul = document.createElement("ul");
    let counter = 0;
    for (current_location in locations) {
        const this_location = locations[current_location];

        /* Display this line only if the chager meets all of the criteris.  */
        if (is_suitable(this_location, local_data)) {
            const title = this_location.charger_data.AddressInfo.Title;
            const street_address = this_location.charger_data.AddressInfo.AddressLine1;
            const town = this_location.charger_data.AddressInfo.Town;
            const state = this_location.charger_data.AddressInfo.StateOrProvince;
            const charger_latitude = this_location.charger_data.AddressInfo.Latitude;
            const charger_longitude = this_location.charger_data.AddressInfo.Longitude;
            const vehicle_longitude = local_data.longitude;
            const vehicle_latitude = local_data.latitude;
            const distance = calculatedistance ([vehicle_latitude, vehicle_longitude],
                [charger_latitude, charger_longitude]);
            let distance_string = null;
            const distance_integer = distance.toFixed(0);
            if ((distance_integer < 2.0) && (distance_integer > 0)) {
                distance_string = distance_integer + " mile";
            } else {
                distance_string = distance_integer + " miles";
            }
            const bearing = calculate_bearing ([vehicle_latitude, vehicle_longitude],
                [charger_latitude, charger_longitude]);
            let direction = null;
            if ((bearing > (360 - 45) || (bearing <= 45))) {
                direction = "North";
            }
            if ((bearing > (90 - 45)) && (bearing <= (90 + 45))) {
                direction = "East";
            }
            if ((bearing > (180 - 45)) && (bearing <= (180 + 45))) {
                direction = "South";
            }
            if ((bearing > (270 - 45)) && (bearing <= (270 + 45))) {
                direction = "West";
            }
            const weather_description =
                this_location.weather.current.weather[0].description;
            locationsPull = "<span>Charger " + title + " at " + street_address +
                " in " + town + ", " + state + " is " + distance_string + " " + direction +
                " (" + Number(bearing).toFixed(0) + "°).  " +
                "The weather is " + weather_description + ".  Click <a href='" +
                "https://www.plugshare.com/?latitude=" + 
                this_location.charger_data.AddressInfo.Latitude +
                "&longitude=" + this_location.charger_data.AddressInfo.Longitude + 
                "&spanLat=0.003&spanLng=0.005' target='_blank'>" + 
                "here</a> for more information about the charger.  " +
                "Click <a href='https://forecast.weather.gov/MapClick.php?lat=" +
                this_location.charger_data.AddressInfo.Latitude +
                "&lon=" + this_location.charger_data.AddressInfo.Longitude +
                "#.YnGRO9rMLo8' target='_blank'> here</a> for more information" +
                " about the weather at that location."
                "</span>";
            let li = document.createElement("li");
            li.innerHTML = locationsPull;
            ul.appendChild(li);
            counter++
        }
    }
    if (counter === 0) {
        let li = document.createElement("li");
        li.appendChild(document.createTextNode('No Chargers within Search Criteria'));
        ul.appendChild(li);
    }
    div.appendChild(ul);
}

/* Function to decide whether to display a charger.  It looks at the distance from
 * the car, the direction, and the availability of suitable connectors.  */
function is_suitable(location, local_data) {
    const charger_latitude = location.charger_data.AddressInfo.Latitude;
    const charger_longitude = location.charger_data.AddressInfo.Longitude;
    const charger_location = [charger_latitude, charger_longitude];

    const vehicle_location = [local_data.latitude, local_data.longitude];
    const North = local_data.North;
    const South = local_data.South;
    const East = local_data.East;
    const West = local_data.West;
    const wants_Tesla = local_data.Tesla;
    const wants_CCS = local_data.CCS;
    const wants_CHAdeMO = local_data.CHAdeMO;
    const maximum_distance = local_data.maximum_distance;
    const minimum_distance = local_data.minimum_distance;

    /* See which charger connections are present at this 
        * location.  */
    const connections = location.charger_data.Connections;
    let has_Tesla = false;
    let has_CCS = false;
    let has_CHAdeMO = false;
    for (let i = 0; i < connections.length; i++) {
        const connection_type = connections[i].ConnectionTypeID;
        if ((connection_type == 30) ||
            (connection_type == 31) ||
            (connection_type == 8) ||
            (connection_type == 27)) {
            has_Tesla = true;
        }
        if ((connection_type == 32) ||
            (connection_type == 33)) {
            has_CCS = true;
        }
        if (connection_type == 2) {
            has_CHAdeMO = true;
        }
    }

    /* If we don't have any of the requested connectors,
     * don't show this charger.  */
    let show_charger = false;
    if (wants_Tesla && has_Tesla) {
        show_charger = true;
    }
    if (wants_CCS && has_CCS) {
        show_charger = true;
    }
    if (wants_CHAdeMO && has_CHAdeMO) {
        show_charger = true;
    }
    /* If the charger doesn't have any of the connectors we want,
     * it doesn't matter where it is, we won't show it.  */
    if (!show_charger) {
        return false;
    }
    /* Check the distance and direction.  */
    if (should_show(vehicle_location, charger_location,
        North, South, East, West, local_data)) {
        return true;
    } else {
        return false;
    }
}

$("#user-form").on("submit", getChargers);
function getChargers(event) {
    event.preventDefault();
    const cityName = $("#searchInput").val();
    console.log(cityName);

    /* Replace the previous search results by a message saying that the
     * search for suitable chargers is in progress.  */
    const ul = document.createElement('ul')
    const div = document.getElementById("resultsList");
    div.removeChild(div.firstChild);
    const li = document.createElement('li');
    li.appendChild(document.createTextNode('Search in progress.'));
    ul.appendChild(li);
    div.appendChild(ul);

    const north = $("#north")[0].checked;
    const south = $("#south")[0].checked;
    const east = $("#east")[0].checked;
    const west = $("#west")[0].checked;
    const Tesla = $("#Tesla")[0].checked;
    const CCS = $("#CCS")[0].checked;
    const CHAdeMO = $("#CHAdeMO")[0].checked;
    const minimum_distance = minimum_distance_EL.value;
    const maximum_distance = maximum_distance_EL.value;

    /* Get the latitude and longitude of the provided city.
     * This is an asynchronous function, so it calls its
     * second parameter with the latitude and longitude
     * when it is done.  It also passes along local_data,
     * which is an object containing the data local to
     * this function that the continuation function
     * is to have.  That is in turn passed from one
     * asynchronous function to another so the display
     * function can have access to the filters specified
     * by the user.  */
    const local_data = {
        "North": north,
        "South": south,
        "East": east,
        "West": west,
        "Tesla": Tesla,
        "CCS": CCS,
        "CHAdeMO": CHAdeMO,
        "minimum_distance": minimum_distance,
        "maximum_distance": maximum_distance
    }
    getLatLon(cityName, found_city, local_data);
}

/* Function to continue processing once we have found
 * the latitude and longitude.  */
function found_city(latitude, longitude, local_data) {
    console.log(latitude, longitude);
    /* Add the latitude and longitude to local data.
     * It will be needed to compute the distance to
     * each charger, for filtering the result.  */
    local_data.latitude = latitude;
    local_data.longitude = longitude;

    const maximum_distance = local_data.maximum_distance;
    const minimum_distance = local_data.minimum_distance;
    /* Display the requested information.  */
    populate_global_storage([latitude, longitude],
        display_charger_data, local_data);
}

const minimum_distance_EL = document.getElementById("minimum_distance");
const maximum_distance_EL = document.getElementById("maximum_distance");
const minimum_distance_miles_EL = document.getElementById("display_minimum_miles");
const maximum_distance_miles_EL = document.getElementById("display_maximum_miles");

/* Display the default values until the user changes them.  */
minimum_distance_miles_EL.innerHTML = minimum_distance_EL.value; 
maximum_distance_miles_EL.innerHTML = maximum_distance_EL.value;

// Update the current slider values (each time you drag the slider handle)
minimum_distance.oninput = function () {
    display_minimum_miles.innerHTML = this.value;
}
maximum_distance.oninput = function () {
    display_maximum_miles.innerHTML = this.value;
}

/* Function to compute the latitude and longitude of a named place.
 * Because this function is asynchronous it cannot just return its
 * results to its caller.  Instead it calls its second parameter
 * when the results are ready.  When calling its second parameter
 * it passes three parameters: the latitude, the longitude, and
 * local_data, an object passed to it, which it just passes on.
 * Local_data can be used to hold any information that the caller
 * of getLatLon wishes to pass along to the function which
 * receives the latitude and longitude.  
 * If the place name cannot be found it shows the user an
 * error message and does not call the third parameter.  */
function getLatLon(town, here, local_data) {
    //Geo Location API
    let locationAPI = "https://api.openweathermap.org/geo/1.0/direct?q=" +
        town + "&limit=1&appid=9b5e0cfaf7521800f4e152fb32e8c146"
    fetch(locationAPI)
        .then(function (response) { return response.json() })
        .then(function (data) {
            console.log(data);

            if (data.length > 0) {
                here(data[0].lat, data[0].lon, local_data);
            } else {
                let ul = document.createElement('ul')
                let div = document.getElementById("resultsList");
                div.removeChild(div.firstChild);
                let li = document.createElement('li');
                li.appendChild(document.createTextNode('No such location'));
                ul.appendChild(li);
                div.appendChild(ul);


            }


        })
}


/* This function will make a judgement call on the charger
based on distance, and direction from the car. First parameter 
is the cars location, second parameter is the chargers location, 
the third parameter is the distance limit. The fourth, fifth, 
sixth, and seventh parameters will be the direction toggles.
Returns true if the charger meets the criteria. Returns false if 
it doesn't.*/
function should_show(vehiclelocation, chargerslocation,
    North, South, East, West, local_data) {
    const distance = calculatedistance(vehiclelocation, chargerslocation);
    const maximum_distance = local_data.maximum_distance;
    const minimum_distance = local_data.minimum_distance;

    /* If the charger is too distance or too close, don't display it.  */
    if ((distance > maximum_distance) || (distance < minimum_distance)) {
        return false;
    }

    /* If the charger is in the wrong direction, don't display it.  */
    const vehiclelatitude = vehiclelocation[0];
    const chargerslatitude = chargerslocation[0];
    const bearing = calculate_bearing (vehiclelocation, chargerslocation);

    if (!North) {
        /* The user isn't going North.  If the bearing is within
         * 45 degrees of North (0) this is not a good charger.  */
        if ((bearing > (360 - 45) || (bearing < 45))) {
            return false;
        }
    }

    if (!South) {
        /* The user isn't going South.  If the bearing is within
         * 45 degrees of South (180) this is not a good charger.  */
        if ((bearing > (180 - 45) && (bearing < (180 + 45)))) {
            return false;
        }
    }

    if (!East) {
        /* The user isn't going East.  If the bearing is within
         * 45 degrees of East (90) this is not a good charger.  */
        if ((bearing > (90 - 45)) && (bearing < (90 + 45))) {
            return false;
        }
    }

    if (!West) {
        /* The user isn't going West.  If the bearing is within
         * 45 degrees of West (270) this is not a good charger.  */
        if ((bearing > (270 - 45)) && (bearing < (270 + 45))) {
            return false;
        }
    }

    /* Note in the above tests that if a charger is exactly
     * between two cardinal directions it will be included if
     * either of the directions is specified.  */

    return true; /*passed all tests*/
}

/*This function will calculate the distance between two points 
on the earths surface. The parameters for this function are the two 
points, and the result is the distance.

Distance
This uses the ‘haversine’ formula to calculate the great-circle distance between two points – that is, the shortest distance over the earth’s surface – giving an ‘as-the-crow-flies’ distance between the points (ignoring any hills they fly over, of course!).

Haversine
formula:	a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
c = 2 ⋅ atan2( √a, √(1−a) )
d = R ⋅ c
where	φ is latitude, λ is longitude, R is earth’s radius (mean radius = 6,371km);
note that angles need to be in radians to pass to trig functions!
	

 https://www.movable-type.co.uk/scripts/latlong.html
 © 2002-2022 Chris Veness
 */
function calculatedistance(pointone, pointtwo) {
    
    const R = 6371e3; // metres
    const lat1= pointone[0];
    const lon1= pointone[1];
    const lat2= pointtwo[0];
    const lon2= pointtwo[1]; 
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres

    const miles = d / 1609.344;
    return miles
}

/* Calculate the direction from one point on the Earth's surface
 * to another.  Thanks again to Chris Venes for this algorithm.
 *
 * Bearing
 * In general, your current heading will vary as you follow a 
 * great circle path (orthodrome); the final heading will differ 
 * from the initial heading by varying degrees according to 
 * distance and latitude (if you were to go from say 35°N,45°E 
 * (≈ Baghdad) to 35°N,135°E (≈ Osaka), you would start on a 
 * heading of 60° and end up on a heading of 120°!).
 * 
 * This formula is for the initial bearing (sometimes referred to 
 * as forward azimuth) which if followed in a straight line along 
 * a great-circle arc will take you from the start point to the 
 * end point.  See note below concerning accuracy.
 * 
 * Formula:	θ = atan2( sin Δλ ⋅ cos φ2 , 
 *          cos φ1 ⋅ sin φ2 − sin φ1 ⋅ cos φ2 ⋅ cos Δλ )
 * 
 * where φ1,λ1 is the start point, φ2,λ2 the end point 
 * (Δλ is the difference in longitude)
 */
function calculate_bearing(point_one, point_two) {
    const lat1 = point_one[0];
    const lon1 = point_one[1];
    const lat2 = point_two[0];
    const lon2 = point_two[1];
    
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    /*
     * Since atan2 returns values in the range -π ... +π 
     * (that is, -180° ... +180°), to normalise the result 
     * to a compass bearing (in the range 0° ... 360°, 
     * with negative values transformed into the range 
     * 180° ... 360°), convert to degrees and then use 
     * (θ+360) % 360, where % is (floating point) modulo.
     */
    const brng = (θ * 180 / Math.PI + 360) % 360; // in degrees
    return (brng);
}

/* Note from Chris Veness on accuracy:
 *
 * Accuracy: since the earth is not quite a sphere, there are 
 * small errors in using spherical geometry; the earth is actually 
 * roughly ellipsoidal (or more precisely, oblate spheroidal) 
 * with a radius varying between about 6,378 km (equatorial) and 
 * 6,357 km (polar), and local radius of curvature varying from 
 * 6,336 km (equatorial meridian) to 6,399 km (polar). 
 * 6,371 km is the generally accepted value for the earth’s mean 
 * radius. This means that errors from assuming spherical geometry 
 * might be up to 0.55% crossing the equator, though generally 
 * below 0.3%, depending on latitude and direction of travel 
 * (whuber explores this in excellent detail on stackexchange). 
 * An accuracy of better than 3m in 1km is mostly good enough 
 * for me, but if you want greater accuracy, you could use the 
 * Vincenty formula for calculating geodesic distances on 
 * ellipsoids, which gives results accurate to within 1mm. 
 * (Out of sheer perversity – I’ve never needed such accuracy – 
 * I looked up this formula and discovered the JavaScript 
 * implementation was simpler than I expected).
 * 
 * Copyright © 2002-2022 Chris Veness
 * https://www.movable-type.co.uk/scripts/latlong.html
 */

/* Thanks to Miguel Albrecht for the following algorithm, used to 
 * prevent putting the API keys in the source code in plain text.  
 */

// encode credentials before storing
function encodeCredentials(crds) {
    // Object expected, e.g. {'api-id':'K0xf56g', 'pwd':'Some.Pa$$w0rd'}.
    const crd = JSON.stringify(crds);
    const len = crd.length;
    // This constraint is due to storing the length in one byte.
    if (len > 159) return null;

    let s = Array.from(saltCredentials);
    let i = 0, j = 2, step = Math.floor(s.length / len);

    // Make sure the pepper is well salted (at least 3 bytes in between).
    while (step <= 2) {
        s = s.concat(s.reverse());
        step = Math.floor(s.length / len);
    }
    // Encode length and step in the first two bytes.
    s.splice(0, 0, String.fromCharCode(96 + len));
    s.splice(1, 0, String.fromCharCode(96 + step));
    // Pepper the salt.
    while (i < len) {
        s.splice(j, 0, crd.charAt(i++));
        j += step;
    }
    // AES encrypt to wrap it up.
    return CryptoJS.AES.encrypt(s.join(''), saltCredentials).toString();
}

// decode credentials upon receiving them from store
function decodeCredentials(crd) {
    // Decrypt it first.
    const dec = CryptoJS.AES.decrypt(crd, saltCredentials).toString(CryptoJS.enc.Utf8);
    // Extract the creds length and pepper step.
    const len = dec.charCodeAt(0) - 96;
    const step = dec.charCodeAt(1) - 96;
    let i = 0, j = 2, d = [];

    // extract the pepper from the salt
    while (i < len) {
        d[i++] = dec[j];
        j += step;
    }
    // Return the object.
    return JSON.parse(d.join(''));
}

