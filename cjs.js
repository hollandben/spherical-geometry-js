'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/** @type {number} Earth's radius (at the Ecuator) of 6378137 meters. */
const EARTH_RADIUS = 6378137;

function toDegrees(radians) {
	return radians * 180 / Math.PI;
}

function toRadians(angleDegrees) {
	return angleDegrees * Math.PI / 180.0;
}

const LAT = 'Latitude';
const LNG = 'Longitude';

const has = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

/**
 * Converts an object into a LatLng. Tries a few different methods:
 * 1. If instanceof LatLng, clone and return the object
 * 2. If it has 'lat' and 'lng' properties...
 *    2a. if the properties are functions (like Google LatLngs),
 *        use the lat() and lng() values as lat and lng
 *    2b. otherwise get lat and lng, parse them as floats and try them
 * 3. If it has 'lat' and *'long'* properties,
 *    parse them as floats and return a LatLng
 * 4. If it has number values for 0 and 1, use 1 as latitude and 0
 *    as longitude.
 * 5. If it has x and y properties, try using y as latitude and x and
 *    longitude.
 * @param {any} like
 * @param {function} [Class=LatLng]
 * @returns {LatLng}
 */
function convert(like, Class = LatLng) {
	if (like instanceof LatLng) return new Class(like[LAT], like[LNG]);
	else if (has(like, 'lat') && has(like, 'lng')) {
		if (typeof like.lat == 'function' && typeof like.lng == 'function')	{
			return new Class(like.lat(), like.lng());
		} else {
			return new Class(parseFloat(like.lat), parseFloat(like.lng));
		}
	} else if (has(like, 'lat') && has(like, 'long')) {
		return new Class(parseFloat(like.lat), parseFloat(like.long));
	} else if (typeof like[0] === 'number' &&	typeof like[1] === 'number') {
		return new Class(like[1], like[0]);
	} else if (has(like, 'x') && has(like, 'y')) {
		return new Class(parseFloat(like.y), parseFloat(like.x));
	}
}

/**
 * Comparison function
 * @param {LatLng} one
 * @param {LatLng} two
 * @returns {boolean}
 */
function equals(one, two) {
	one = convert(one); two = convert(two);
	return (
		Math.abs(one[LAT] - two[LAT] < Number.EPSILON) &&
		Math.abs(one[LNG] - two[LNG] < Number.EPSILON)
	)
}

class LatLng {
	constructor(lat, lng, noWrap = false) {
		lat = parseFloat(lat);
		lng = parseFloat(lng);

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			throw TypeError('lat or lng are not numbers');
		}

		if (!noWrap) {
			//Constrain lat to -90, 90
			lat = Math.min(Math.max(lat, -90), 90);
			//Wrap lng using modulo
			lng = lng==180 ? lng : ((lng + 180) % 360 + 360) % 360 - 180
		}

		Object.defineProperty(this, LAT, {value: lat});
		Object.defineProperty(this, LNG, {value: lng});
		this.length = 2;
	}

	/**
	 * Comparison function
	 * @param {LatLng} other
	 * @returns {boolean}
	 */
	equals(other) {return equals(this, other);}

	/**
	 * Returns the latitude in degrees.
	 * (I'd rather use getters but this is for consistency)
	 * @returns {number}
	 */
	lat() {return this[LAT];}

	/**
	 * Returns the longitude in degrees.
	 * (I'd rather use getters but this is for consistency)
	 * @returns {number}
	 */
	lng() {return this[LNG];}

	/** @type {number} alias for lng */
	get x() {return this[LNG]}
	/** @type {number} alias for lat */
	get y() {return this[LAT]}
	/** @type {number} alias for lng */
	get 0() {return this[LNG]}
	/** @type {number} alias for lat */
	get 1() {return this[LAT]}
	/** @type {number} alias for lng */
	get long() {return this[LNG]}

	/**
	 * Converts to JSON representation. This function is intented to be used via
	 * JSON.stringify.
	 * @returns {Object} LatLngLiteral
	 */
	toJSON() {
		return {lat: this[LAT], lng: this[LNG]};
	}

	/**
	 * Converts to string representation.
	 * @returns {string}
	 */
	toString() {
		return `(${this[LAT]}, ${this[LNG]})`;
	}

	/**
	 * Returns a string of the form "lat,lng" for this LatLng. We round the
	 * lat/lng values to 6 decimal places by default.
	 * @param {number} [precision=6]
	 * @returns {string}
	 */
	toUrlValue(precision = 6) {
		precision = parseInt(precision);
		return this[LAT].toFixed(precision) + ',' + this[LNG].toFixed(precision);
	}
}

/**
 * Returns the distance, in meters, between to LatLngs. You can optionally 
 * specify a custom radius. The radius defaults to the radius of the Earth.
 * @param {LatLng} from
 * @param {LatLng} to
 * @param {number} [radius]
 * @returns {number} distance
 */
function computeDistanceBetween(from, to, radius = EARTH_RADIUS) 
{
	from = convert(from); to = convert(to);
	const radFromLat = toRadians(from.lat()), radFromLng = toRadians(from.lng());
	const radToLat = toRadians(to.lat()), radToLng = toRadians(to.lng());
	return 2 * Math.asin(Math.sqrt(
		Math.pow(Math.sin((radFromLat - radToLat) / 2), 2) 
		+ Math.cos(radFromLat) * Math.cos(radToLat) * 
		Math.pow(Math.sin((radFromLng - radToLng) / 2), 2)
	)) * radius;
}

/**
 * Returns the signed area of a closed path. The signed area may be used to 
 * determine the orientation of the path. The computed area uses the same units 
 * as the radius. The radius defaults to the Earth's radius in meters, in which 
 * case the area is in square meters.
 * @param {LatLng[]} loop
 * @param {number} [radius]
 * @returns {number}
 */
function computeSignedArea(loop, radius = EARTH_RADIUS) {
	if (loop.length < 3) return 0;
	loop = loop.map(v => convert(v));

	let e = 0;
	for (let i = 1; i < loop.length - 1; i++) {
		e += computeSphericalExcess([loop[0], loop[i], loop[i+1]]);
	}

	return e * Math.pow(radius, 2);
}

/**
 * Computes the spherical excess.
 * Uses L'Huilier's Theorem.
 * @param {LatLng[]} polygon
 * @param {boolean} [options.signed=true]
 * @returns {number}
 */
function computeSphericalExcess(polygon, options = {}) {
	const {signed = true} = options;
	if (polygon.length !== 3) throw TypeError();
	let distances = [], sumOfDistances = 0;

	for (let i = 0; i < polygon.length - 1; i++) {
		distances[i] = computeDistanceBetween(
			polygon[i], polygon[i + 1],
			1
		);
		sumOfDistances += distances[i];
	}

	const semiPerimeter = sumOfDistances / 2;
	let tan = Math.tan(semiPerimeter / 2);
	for (const distance of distances) 
		tan *= Math.tan((semiPerimeter - distance) / 2);
	
	const sphericalExcess = 4 * Math.atan(Math.sqrt(Math.abs(tan)));

	if (!signed) return sphericalExcess;
	
	const v = polygon.map(point => {
		const lat = toRadians(point.lat()), lng = toRadians(point.lng());
		return [
			Math.cos(lat) * Math.cos(lng),
			Math.cos(lat) * Math.sin(lng),
			Math.sin(lat)
		];
	});

	const sign = 
		( v[0][0] * v[1][1] * v[2][2] 
		+ v[1][0] * v[2][1] * v[0][2] 
		+ v[2][0] * v[0][1] * v[1][2] 
		- v[0][0] * v[2][1] * v[1][2] 
		- v[1][0] * v[0][1] * v[2][2] 
		- v[2][0] * v[1][1] * v[0][2] ) > 0 ? 1 : -1;
	
	return sphericalExcess * sign;
}

/**
 * Returns the area of a closed path. The computed area uses the same units as 
 * the radius. The radius defaults to the Earth's radius in meters, in which 
 * case the area is in square meters.
 * @param {LatLng[]} path
 * @param {number} [radius]
 * @returns {number} area
 */
function computeArea(path, radius) {
	if (path.length < 3) return 0;
	path = path.map(v => convert(v));

	let e = 0;
	for (let i = 1; i < path.length - 1; i++) 
		e += computeSphericalExcess([path[0], path[i], path[i+1]], {signed: false});

	return e * Math.pow(radius, 2);
}

const fmod = (a, b) => Number((a - (Math.floor(a / b) * b)).toPrecision(8));

/**
 * Returns the heading from one LatLng to another LatLng. Headings are expresss
 * in degrees clockwise from North within the range [-180, 180).
 * @param {LatLng} from
 * @param {LatLng} to
 * @returns {number}
 */
function computeHeading(from, to) {
	from = convert(from); to = convert(to);
	const fromLat = toRadians(from.lat()),
		toLat = toRadians(to.lat()),
		deltaLng = toRadians(to.lng()) - toRadians(from.lng());
	
	const angle = toDegrees(
		Math.atan2(
			Math.sin(deltaLng) * Math.cos(toLat), 
			Math.cos(fromLat) * Math.sin(toLat) - 
			Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng)
		)
	);

	if (angle === 180) return angle;
	else return fmod( (fmod((angle - -180), 360) + 360), 360 ) + -180;
}

/**
 * Returns the length of the given path.
 * @param {LatLng[]} path
 * @param {number} [radius]
 * @returns {number}
 */
function computeLength(path, radius = EARTH_RADIUS) {
	let length = 0;
	for (let i = 0; i < path.length - 1; i++) 
		length += computeDistanceBetween(path[i], path[i+1], radius);
	return length;
}

/**
 * Returns the LatLng resulting from moving a distance from an origin in the 
 * specified heading (expressed in degrees clockwise from north).
 * @param {LatLng} from
 * @param {number} distance
 * @param {number} heading
 * @param {number} [radius]
 * @returns {LatLng}
 */
function computeOffset(
	from, distance, heading, radius = EARTH_RADIUS
) {
	from = convert(from);
	distance /= radius;
	heading = toRadians(heading);

	const fromLat = toRadians(from.lat());
	const cosDistance = Math.cos(distance);
	const sinDistance = Math.sin(distance);
	const sinFromLat = Math.sin(fromLat);
	const cosFromLat = Math.cos(fromLat);
	const sc = cosDistance * sinFromLat + sinDistance 
		* cosFromLat * Math.cos(heading);
		
	return new LatLng(
		toDegrees(Math.asin(sc)),
		toDegrees(toRadians(from.lng()) + Math.atan2(sinDistance 
				* cosFromLat * Math.sin(heading), 
			cosDistance - sinFromLat * sc))
	);
}

/**
 * Returns the LatLng which lies the given fraction of the way between the 
 * origin LatLng and the destination LatLng.
 * @param {LatLng} from
 * @param {LatLng} to
 * @param {number} fraction
 * @returns {LatLng} 
 */
function interpolate(from, to, fraction) 
{
	from = convert(from); to = convert(to);
	const radFromLat = toRadians(from.lat()), radFromLng = toRadians(from.lng());
	const radToLat = toRadians(to.lat()), radToLng = toRadians(to.lng());

	const cosFromLat = Math.cos(radFromLat), cosToLat = Math.cos(radToLat);
	
	const radDist = computeDistanceBetween(from, to);
	const sinRadDist = Math.sin(radDist);

	if (sinRadDist < 1e-6) return from;

	const a = Math.sin((1 - fraction) * radDist) / sinRadDist;
	const b = Math.sin(fraction * radDist) / sinRadDist;
	const c = a * cosFromLat * Math.cos(radFromLng) 
		+ b * cosToLat * Math.cos(radToLng);
	const d = a * cosFromLat * Math.sin(radFromLng) 
		+ b * cosToLat * Math.sin(radToLng);

	return new LatLng(
		toDegrees(
			Math.atan2(
				a * Math.sin(radFromLat) + b * Math.sin(radToLat),
				Math.sqrt(Math.pow(c, 2) + Math.pow(d, 2))
			)
		),
		toDegrees(Math.atan2(d, c))
	);
}

exports.computeArea = computeArea;
exports.computeDistanceBetween = computeDistanceBetween;
exports.computeHeading = computeHeading;
exports.computeLength = computeLength;
exports.computeOffset = computeOffset;
exports.computeSignedArea = computeSignedArea;
exports.interpolate = interpolate;
exports.LatLng = LatLng;
exports.convertLatLng = convert;
exports.equalLatLngs = equals;
exports.EARTH_RADIUS = EARTH_RADIUS;
exports.toDegrees = toDegrees;
exports.toRadians = toRadians;
//# sourceMappingURL=cjs.js.map
