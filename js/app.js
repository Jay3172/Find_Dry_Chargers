$(document).foundation()

/* The global object which holds the charger locations
 * and the weather at each.  This data is held in local
 * storage so we don't lose it when the program restarts.
 * This data is accumulated by the API calls.  We use it
 * to avoid excessive use of the APIs.
 */
let global_storage = {
    locations: {}
};

/* Fetch our global storage from local storage.  */
const global_storage_string = localStorage.getItem("find_dry_chargers");
if (global_storage_string != null) {
  global_storage = JSON.parse(global_storage_string);
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
 * The second parameter is the distance from that location,
 * in miles.
 * The third parameter is the function that is called when
 * the population of global storage is complete.
 */
function populate_global_storage (location, range, completion) {
    /* We remember the completion function in a global.  */
    completion_function = completion;
    const latitude = location[0];
    const longitude = location[1];

    /* Use the Open Charge Map API to get a list of nearby chargers.  */
    let the_URL = "https://api.openchargemap.io/v3/poi/?output=json&countrycode=us";
    the_URL = the_URL + "&maxresults=100";
    the_URL = the_URL + "&key=" + open_charge_map_API_key;
    the_URL = the_URL + "&latitude=" + latitude;
    the_URL = the_URL + "&longitude=" + longitude;
    the_URL = the_URL + "&distance=" + range;
    the_URL = the_URL + "&levelid=3";
    fetch(the_URL)
        .then(function (response) { return response.json() })
        .then(function (data) { process_charger_pois(data) });
}

/* Function to process the charger points of interest. 
 * Each point of interest is placed in global storage
 * so we can fetch its weather later.
 */

function process_charger_pois(data) {
    for (let i = 0; i < data.length; i++) {

        /* We remember the chargers by their locations.
         * Form a string so we can store each charger
         * in an object keyed by the location.  */
        const latitude = data[i].AddressInfo.Latitude;
        const longitude = data[i].AddressInfo.Longitude;
        const location_string = "lat=" + latitude.toFixed(4) +
            ",lon=" + longitude.toFixed(4) + ";";
        /* Place the charger in global storage so we can attach
         * weather information to it later.  If it is already
         * in global storage it may already have weather
         * information.  */
        if (!(location_string in global_storage.locations)) {
            global_storage.locations[location_string] = {
                "charger_data" : data[i]
            }
        }
    }

    /* Fill in the weather information for each charger location
     * that does not already have its weather.  If the weather
     * information is old, refresh it.
     */
    for (charger_location in global_storage.locations) {
        const this_location = global_storage.locations[charger_location];
        let needs_weather = false;
        if ("weather" in this_location) {
            const last_update_date = new Date(this_location.updated_date);
            const current_date = new Date();
            const seconds_since_last_update = (current_date - last_update_date) / 1000;
            if (seconds_since_last_update > 15*60) {
                needs_weather = true;
            }
         } else {
            needs_weather = true;
        }
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
                .then(function (weather_data) { process_weather_data(weather_data) }
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
    completion_function();
}

/* Function to process weather information for a charger location.
 * We place it in global storage for later display, and so we
 * won't fetch it again.  The location object of the current charger 
 * is remembered in the global variable charger_location.  */
function process_weather_data(weather_data) {
    const this_location = global_storage.locations[charger_location];
    this_location.weather = weather_data;
    const updated_date = new Date();
    this_location.updated_date = updated_date.toISOString();

    /* Now we must process the remaining charger locations that
     * do not have their weather information.  We come back here
     * when each asynchronous operation completes.  When we
     * are done we can proceed.  */
    for (charger_location in global_storage.locations) {
        const this_location = global_storage.locations[charger_location];
        let needs_weather = false;
        if ("weather" in this_location) {
            const last_update_date = new Date(this_location.updated_date);
            const current_date = new Date();
            const seconds_since_last_update = (current_date - last_update_date) / 1000;
            if (seconds_since_last_update > 15*60) {
                needs_weather = true;
            }
         } else {
            needs_weather = true;
        }
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
                    process_weather_data(new_weather_data) 
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

    /* All of the charger locations have weather information.
     * now we can filter and display the results.  */
    completion_function();
}

/* Test the populate_global_storage function.  */
populate_global_storage ([42.83, -71.56], 30, display_charger_data);

/* Function to display the charger data, including weather information
 */
function display_charger_data() {

    /* Remember the data we have gathered for a later run of this
     * application.  */
    localStorage.setItem("find_dry_chargers", 
        JSON.stringify(global_storage));

    const locations = global_storage.locations;
    for (current_location in locations) {
        const this_location = locations[current_location];
        const title = this_location.charger_data.AddressInfo.Title;
        const street_address = this_location.charger_data.AddressInfo.AddressLine1;
        const town = this_location.charger_data.AddressInfo.Town;
        const state = this_location.charger_data.AddressInfo.StateOrProvince;
        const weather_description = 
            this_location.weather.current.weather[0].description;
        console.log ("For charger " + title + " at " + street_address +
            " in " + town + ", " + state +
            " the weather is " + weather_description + ".");
    }
}

function getLatLon (town, here){
    //Geo Location API
   let locationAPI = "http://api.openweathermap.org/geo/1.0/direct?q=" + town + ",&limit=1&appid=9b5e0cfaf7521800f4e152fb32e8c146"
   fetch(locationAPI)
       .then(function(response) {return response.json()})
       .then(function (data) {
           here(data[0].lat, data[0].lon);
       
       })}
       getLatLon("nashua,nh", here);
   
       function here(lat, lon){
           console.log(lat, lon);
       }
   
/* Thanks to Miguel Albrecht for this algorithm, used to prevent
 * putting the API keys in the source code in plain text.  */

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
