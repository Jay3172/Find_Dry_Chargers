$(document).foundation()

/* This is ab obscured form of the API keys, used to avoid
 * putting the API keys into the source code in plain text.
 */
const obscured_API_keys = "U2FsdGVkX19V//ZyFekiRotbw+8m6f7ZSo9OsIqIFY43zSANNHBZ27QmbBNjhILvpfe1uorVhl9GTs5CsoZQr8KmTyXoVO2I4n6nLQzMTlIENgcBWpP35z476/fGfF5Y8RYoNUqni8QNZznltNw1WNd54V5FnCghWKJDPVMckH7ggvQhUZel/twRtitZhZKikwdCHI1cUpSkp9liExGIA/JMj5UxoHNAkM8XEZnYZK5ya1MET8WCRhjk4KDvbfW5ACPFoidMvcot+tjb2uM7qstRMcZfFUhIokH8G29QmKGMVUiaVQumEbnGWxeda5eMBQW10SL4/7kCgDyxQzohM9lJ1F7ezBWeLrT8Q1oQte0c57OtsXQpyuhuXs+p9pAh5iHD9GfNveKkXuWtQJJr5s+kaWrsIzjxCIZPbWtjGaPkZPJtcoLrtjlTDYpjAmFCrJQwG4JGTXyfoNrSWdNq3SfWnrSmSWbrnIB2rdkeFvCE68lXrUDhsc/qA/V3ww7h3CzCfoir+nTbgP4I9ODEdOQzy6uaPSqLnaIeLRcddeJPiQsqAAJYNbQGTrTgCHZBpOf52flcTO82ZWIXMJ9KJjKQx1M1sZj7lFo8++iGLd53umPB/wAcQxdJpk2qH7V6mtjGbS7/PHGxJW15ZSn3R8Xnn1D1e+9mqTY/IO8Efc49iwWJehK3erUZlQRRBVOUfl5pE+DHw5BQKRB/9EIZezCBzXjgMIZrrhx0CN6lsLkuWVK86VguYeubGiwc7xgpMvbauP797vHEWgAr9KHW9QhaKl1b3N36mbrHHS0oOq2ZDg+bNc1tgbBwWZH5oZoOWLgo1gzje1lOzqf6MvNvhKlXHk26iCCndWujRJ974eWSZ/Y81f1GjiIB3+Ww2VruohAjoCkb9RyDOwFZy4WYjjmzpLqQuE4x62VrJS6Af4krYAGn9Jq6eiNezFcBBdcV795bXdLd09i+mkKCz0U7cYAuiJe8y2jtDVpBjxmj7Ee36NgZiw6YNWpMSgpg12y0dT6ZqEqC5XPRcgF1E5VGlA==";

// used to obfuscate and encrypt the credentials
const saltCredentials = "abjf02heg9u64a{%m<83#@;Pxrjg17uyr#@&*%^Y";

const API_keys = decodeCredentials(obscured_API_keys);

Open_Charge_Map_API_key = API_keys.open_charge_map_API_key;

/* Test out open charge map.  */
let the_URL = "https://api.openchargemap.io/v3/poi/?output=json&countrycode=us";
the_URL = the_URL + "&maxresults=100";
the_URL = the_URL + "&key=" + Open_Charge_Map_API_key;
the_URL = the_URL + "&latitude=42.83&longitude=-71.56&distance=30";
the_URL = the_URL + "&levelid=3";
fetch(the_URL)
    .then(function (response) {return response.json()})
    .then(function(data){process_poi(data)});
    
function process_poi (data) {
    console.log(data);
    for (let i=0;i<data.length;i++) {
        const latitude = data[i].AddressInfo.Latitude;
        const longitude = data[i].AddressInfo.Longitude;
        const distance = data[i].AddressInfo.Distance;
        const title = data[i].AddressInfo.Title;
        const town = data[i].AddressInfo.Town;
        const state = data[i].AddressInfo.StateOrProvince;
        console.log(title + " in " + town + ", " + state + " at " + 
            distance + ": (" + latitude + "," + longitude + ").");
    }
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
    while(step <= 2) {
	s = s.concat(s.reverse());
	step = Math.floor(s.length / len);
    }
    // Encode length and step in the first two bytes.
    s.splice(0, 0, String.fromCharCode(96 + len));
    s.splice(1, 0, String.fromCharCode(96 + step));
    // Pepper the salt.
    while( i < len ) {
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
    while( i < len ) {
	d[i++] = dec[j];
	j += step;
    }
    // Return the object.
    return JSON.parse(d.join(''));
}
