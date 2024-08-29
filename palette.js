// @ts-check

if(window["__ts-check__"]) {
	const {Color} = require("../JustLib/src/justlib/JustLib");
}

class Parameter {
	r = 0;
	g = 0;
	b = 0;

	/**
	 * Creates an instance of Parameter.
	 * @param {number} [r=this.r]
	 * @param {number} [g=this.g]
	 * @param {number} [b=this.b]
	 * @memberof Parameter
	 */
	constructor(r = this.r, g = this.g, b = this.b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}

	randomize(from = -0.125, to = 1.125) {
		this.r = Parameter.randomInRange(from, to);
		this.g = Parameter.randomInRange(from, to);
		this.b = Parameter.randomInRange(from, to);
	}

	clone() {
		return new Parameter(this.r, this.g, this.b);
	}

	toURL() {
		return `${this.r.toFixed(3)}c${this.g.toFixed(3)}c${this.b.toFixed(3)}`;
	}

	/**
	 * @static
	 * @param {string} url
	 * @return {Parameter} 
	 * @memberof Parameter
	 */
	static fromURL(url) {
		const [r, g, b] = url.split("c").map(v => parseFloat(v));
		return new Parameter(r, g, b);
	}

	/**
	 * @static
	 * @param {number} min
	 * @param {number} max
	 * @return {number} 
	 * @memberof Parameter
	 */
	static randomInRange(min, max) {
		return Math.random() * (max - min) + min;
	}
}

class Palette {
	/** @type {Parameter} */
	a;
	/** @type {Parameter} */
	b;
	/** @type {Parameter} */
	c;
	/** @type {Parameter} */
	d;

	/**
	 * Creates an instance of Palette.
	 * @param {Parameter} a
	 * @param {Parameter} b
	 * @param {Parameter} c
	 * @param {Parameter} d
	 * @memberof Palette
	 */
	constructor(a, b, c, d) {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
	}

	/**
	 * @static
	 * @private
	 * @type {Color}
	 * @memberof Palette
	 */
	static _color = new Color(0, 0, 0);

	/**
	 * @param {number} x
	 * @return {Color} 
	 * @memberof Palette
	 */
	getColor(x) {
		Palette._color.r = this.getChannel(x, 0);
		Palette._color.g = this.getChannel(x, 1);
		Palette._color.b = this.getChannel(x, 2);
		return Palette._color;
	}

	/**
	 * @param {number} x
	 * @param {0 | 1 | 2 | number} ch
	 * @return {number} 
	 * @memberof Palette
	 */
	getChannel(x, ch) {
		switch(ch) {
			case 0: return this.a.r + this.b.r * Math.cos(2 * Math.PI * (this.c.r * x + this.d.r));
			case 1: return this.a.g + this.b.g * Math.cos(2 * Math.PI * (this.c.g * x + this.d.g));
			case 2: return this.a.b + this.b.b * Math.cos(2 * Math.PI * (this.c.b * x + this.d.b));
			default: throw new Error(`Invalid channel: "${ch}"`);
		}
	}

	randomize() {
		this.a.randomize();
		this.b.randomize();
		this.c.randomize(0, 2);
		this.d.randomize(0, 1);
	}

	clone() {
		return new Palette(this.a.clone(), this.b.clone(), this.c.clone(), this.d.clone());
	}

	toURL() {
		return `${this.a.toURL()}p${this.b.toURL()}p${this.c.toURL()}p${this.d.toURL()}`;
	}

	/**
	 * @static
	 * @param {string} url
	 * @return {Palette} 
	 * @memberof Palette
	 */
	static fromURL(url) {
		const [a, b, c, d] = url.split("p").map(v => Parameter.fromURL(v));
		return new Palette(a, b, c, d);
	}
}

if(window["__ts-check__"]) {
	module.exports = {
		Parameter,
		Palette
	};
}