// @ts-check

if(window["__ts-check__"]) {
	const {Palette, Parameter} = require("./palette");
	const {Color, copyToClipboard, timeout} = require("../JustLib/src/justlib/JustLib");
	const {JLRenderer2D} = require("../JustLib/src/justlibdraw/JustLibDraw");
	const {ReactiveProperty, Component, html, NodeReference, ItemListComponent, RP} = require("../reactive-dom/framework2");
}

/** @import {Prop} from "../reactive-dom/framework2" */

class Utils {
	/**
	 * @static
	 * @param {number} t
	 * @return {number} 
	 * @memberof Utils
	 */
	static easeInOut(t) {
		return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
	}

	/**
	 * @static
	 * @param {number} a
	 * @param {number} b
	 * @param {number} t
	 * @return {number} 
	 * @memberof Utils
	 */
	static lerp(a, b, t) {
		return a * (1 - t) + b * t;
	}

	// eslint-disable-next-line valid-jsdoc
	/**
	 * @template {(...args: any[]) => void} T
	 * @static
	 * @param {T} func
	 * @param {number} delay
	 * @return {T} 
	 * @memberof MainApp
	 */
	static debounce(func, delay) {
		let timeoutId;

		// @ts-ignore
		return function(...args) {
			clearTimeout(timeoutId);

			timeoutId = setTimeout(() => {
				func.apply(this, args);
			}, delay);
		};
	}
}

class ParameterSlider extends Component {
	static tagName = "parameter-slider";

	/** @type {ReactiveProperty} */
	trigger;

	/** @type {() => number} */
	get;

	/** @type {(v: number) => void} */
	set;

	/** @type {number} */
	min;

	/** @type {number} */
	max;

	/** @type {NodeReference<HTMLInputElement>} */
	input = new NodeReference();

	// eslint-disable-next-line valid-jsdoc
	/**
	 * @param {{trigger: ReactiveProperty, get: () => number, set: (v: number) => void, min?: number, max?: number}} props
	 * @memberof ParameterSlider
	 */
	async init({trigger, get, set, min = -2, max = 2}) {
		this.trigger = trigger;
		this.get = get;
		this.set = set;
		this.min = min;
		this.max = max;

		this.subscribeTo(_ => {
			this.input.node.value = this.get() + "";
		}, [trigger]);
	}

	/**
	 * @param {number} value
	 * @memberof ParameterSlider
	 */
	onChange(value) {
		this.set(value);
		this.trigger.update();
	}

	render() {
		return html`<parameter-slider>
			<input
				ref=${this.input}
				type="range"
				min="${this.min}"
				max="${this.max}"
				step="0.001"
				value="${this.get()}"
				oninput="${e => this.onChange(+e.target.value)}"
			><code>${this.trigger.as(_ => this.get().toFixed(3))}</code>
		</parameter-slider>`;
	}
}
Component.register(ParameterSlider);

const CURVE_STEP = 5;
const CURVE_WIDTH = 5;
class CanvasRenderer extends Component {
	static tagName = "canvas-renderer";

	/** @type {Palette} */
	palette;

	/** @type {ReactiveProperty} */
	trigger;

	/** @type {ReactiveProperty<number>} */
	avgHue;

	/** @type {ReactiveProperty<Uint8ClampedArray>} */
	colorBuffer;

	previewHeight = 0;
	previewOffset = 0;

	previewRenderer = new JLRenderer2D({
		width: window.innerWidth,
		height: window.innerHeight,
		root: this
	});
	renderer = new JLRenderer2D({
		width: window.innerWidth,
		height: 1,
		root: null
	});

	/**
	 * @param {{palette: Palette, trigger: ReactiveProperty, avgHue: ReactiveProperty<number>, colorBuffer: ReactiveProperty<Uint8ClampedArray>}} props
	 * @memberof CanvasRenderer
	 */
	async init({palette, trigger, avgHue, colorBuffer}) {
		this.palette = palette;
		this.trigger = trigger;
		this.avgHue = avgHue;
		this.colorBuffer = colorBuffer;

		this.subscribeTo(_ => {
			this.redraw();
		}, [trigger]);

		window.addEventListener("resize", () => {
			this.previewRenderer.resize(window.innerWidth, window.innerHeight);
			this.renderer.resize(window.innerWidth, 1);
			this.updatePreviewParams();
			this.redraw();
		});

		this.updatePreviewParams();
	}

	updatePreviewParams() {
		this.previewHeight = Math.min(400, window.innerHeight * 0.25);
		this.previewOffset = window.innerHeight * 0.33 - this.previewHeight * 0.5;
	}

	redraw() {
		// Get the variables
		const palette = this.palette;
		const renderer = this.renderer;
		const previewRenderer = this.previewRenderer;
		const previewHeight = this.previewHeight;
		const previewOffset = this.previewOffset;
		const w = this.previewRenderer.width;

		// Clear the preview
		this.previewRenderer.clear();

		// Prepare buffers
		const buffer = new Uint8ClampedArray(w * 4);
		const avgColor = new Color(0, 0, 0);

		// Generate the first row
		for(let x = 0; x < w; x++) {
			const u = x / w;
			const color = palette.getColor(u);

			// Update the average color
			avgColor.r += color.r;
			avgColor.g += color.g;
			avgColor.b += color.b;

			// Write the color to the buffer
			buffer[x * 4 + 0] = color.r * 255;
			buffer[x * 4 + 1] = color.g * 255;
			buffer[x * 4 + 2] = color.b * 255;
			buffer[x * 4 + 3] = 255;
		}

		// Draw the buffer
		const imageData = new ImageData(buffer, w, 1);
		renderer.ctx.putImageData(imageData, 0, 0);

		// Set the canvas background image, the browser will automatically repeat it
		const url = renderer.node.toDataURL();
		previewRenderer.node.style.backgroundImage = `url(${url})`;

		// Prepare for drawing the preview
		previewRenderer.ctx.lineWidth = CURVE_WIDTH;
		previewRenderer.ctx.shadowColor = "rgba(0, 0, 0, 1)";
		previewRenderer.ctx.shadowBlur = 30;

		// Generate the 3 cosine curves for each channel
		for(let ch = 0; ch < 3; ch++) {
			previewRenderer.ctx.beginPath();

			// Set the stroke color to color of the current channel
			previewRenderer.ctx.strokeStyle = `#${(0xFF << (2 - ch) * 8).toString(16).padStart(6, "0")}`;

			// Calculate the initial position of the curve
			const v = -palette.getChannel(0, ch);
			previewRenderer.ctx.moveTo(0, (v + 1) * 0.5 * previewHeight + previewOffset);

			// Draw the curve
			for(let x = CURVE_STEP; x < w + CURVE_STEP; x += CURVE_STEP) {
				const u = x / w;
				const v = -palette.getChannel(u, ch);
				previewRenderer.ctx.lineTo(x, (v + 1) * 0.5 * previewHeight + previewOffset);
			}

			// Draw the curve
			previewRenderer.ctx.stroke();
		}

		// Reset the shadow blur
		previewRenderer.ctx.shadowBlur = 0;

		// Calculate the average color
		avgColor.r = avgColor.r / w * 255;
		avgColor.g = avgColor.g / w * 255;
		avgColor.b = avgColor.b / w * 255;

		// Set the randomize button hue
		const [h, s, l] = avgColor.toHSL();
		this.avgHue.value = h * 360;

		// Set the color buffer
		this.colorBuffer.value = buffer;
	}

	render() {
		return html`<canvas-renderer></canvas-renderer>`;
	}
}
Component.register(CanvasRenderer);

class PaletteControls extends Component {
	static tagName = "palette-controls";

	/** @type {Palette} */
	palette;

	/** @type {ReactiveProperty} */
	trigger;

	/** @type {ReactiveProperty<number>} */
	avgHue;

	/**
	 * @param {{palette: Palette, trigger: ReactiveProperty, avgHue: ReactiveProperty<number>}} props
	 * @memberof PaletteControls
	 */
	async init({palette, trigger, avgHue}) {
		this.palette = palette;
		this.trigger = trigger;
		this.avgHue = avgHue;
	}

	randomize(animate = true) {
		if(!animate) {
			this.palette.randomize();
			this.trigger.update();
			return;
		}

		const source = this.palette.clone();
		const target = this.palette.clone();
		target.randomize();

		this._animationKeyframes = [source, target];
		this._animationStart = performance.now();
		this._runAnimation();
	}

	_isAnimationRunning = false;
	_runAnimation() {
		// Prevent multiple animations at the same time
		if(this._isAnimationRunning) return;
		this._isAnimationRunning = true;

		let _lastFrame = 0;
		const _frame = t => {
			// Calculate the delta time
			const dt = _lastFrame === 0 ? 0 : t - _lastFrame;
			_lastFrame = t;

			// Run the animation frame
			const result = this._animationFrame(dt);

			// If the animation is done, stop the animation
			if(result === false) {
				this._isAnimationRunning = false;
				return;
			}

			// Request the next frame
			window.requestAnimationFrame(_frame);
		};

		// Start the animation
		window.requestAnimationFrame(_frame);
	}

	/** @type {number} */
	_animationStart = 0;

	/** @type {[Palette, Palette] | null} */
	_animationKeyframes = null;

	static ANIMATION_DURATION = 500;

	_animationFrame(dt) {
		// If there is no target, stop the animation
		if(!this._animationKeyframes) return false;

		// Calculate the progress
		const now = performance.now();
		const progress = Math.min(1, (now - this._animationStart) / PaletteControls.ANIMATION_DURATION);
		const t = Utils.easeInOut(progress);

		const [source, target] = this._animationKeyframes;

		// Calculate the new palette
		this.palette.a.r = Utils.lerp(source.a.r, target.a.r, t);
		this.palette.a.g = Utils.lerp(source.a.g, target.a.g, t);
		this.palette.a.b = Utils.lerp(source.a.b, target.a.b, t);
		this.palette.b.r = Utils.lerp(source.b.r, target.b.r, t);
		this.palette.b.g = Utils.lerp(source.b.g, target.b.g, t);
		this.palette.b.b = Utils.lerp(source.b.b, target.b.b, t);
		this.palette.c.r = Utils.lerp(source.c.r, target.c.r, t);
		this.palette.c.g = Utils.lerp(source.c.g, target.c.g, t);
		this.palette.c.b = Utils.lerp(source.c.b, target.c.b, t);
		this.palette.d.r = Utils.lerp(source.d.r, target.d.r, t);
		this.palette.d.g = Utils.lerp(source.d.g, target.d.g, t);
		this.palette.d.b = Utils.lerp(source.d.b, target.d.b, t);

		this.trigger.update();

		// If the animation is done, stop the animation
		return progress < 1;
	}

	render() {
		return html`<palette-controls>
			<div class="randomize">
				<button
					title="Randomize the parameters to create a new palette"
					onclick="${_ => this.randomize()}"
					style="--hue: ${this.avgHue.as(hue => hue + 180)}deg"
				>Randomize</button>
			</div>
			<div class="table">
				<div class="header top left empty"></div>
				<div class="header top">Red</div>
				<div class="header top">Green</div>
				<div class="header top">Blue</div>
				<div class="header left"><small>(Offset)</small> A</div>
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.a.r, set: v => this.palette.a.r = v})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.a.g, set: v => this.palette.a.g = v})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.a.b, set: v => this.palette.a.b = v})}
				<div class="header left"><small>(Amplitude)</small> B</div>
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.b.r, set: v => this.palette.b.r = v})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.b.g, set: v => this.palette.b.g = v})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.b.b, set: v => this.palette.b.b = v})}
				<div class="header left"><small>(Frequency)</small> C</div>
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.c.r, set: v => this.palette.c.r = v, min: 0, max: 4})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.c.g, set: v => this.palette.c.g = v, min: 0, max: 4})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.c.b, set: v => this.palette.c.b = v, min: 0, max: 4})}
				<div class="header left"><small>(Shift)</small> D</div>
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.d.r, set: v => this.palette.d.r = v, min: 0, max: 1})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.d.g, set: v => this.palette.d.g = v, min: 0, max: 1})}
				${ParameterSlider.new({trigger: this.trigger, get: () => this.palette.d.b, set: v => this.palette.d.b = v, min: 0, max: 1})}
			</div>
			<code class="equation">color(x) = <strong>A</strong> + <strong>B</strong>cos(2π(<strong>C</strong>x + <strong>D</strong>))</code>
		</palette-controls>`;
	}
}
Component.register(PaletteControls);

class ColorItem extends Component {
	static tagName = "color-item";

	/** @type {ReactiveProperty<number>} */
	format = new ReactiveProperty(0);

	/** @type {Color} */
	color;

	/** @type {Prop<(item: this) => void>} */
	onRemove;

	/** @type {NodeReference<HTMLButtonElement>} */
	copyButton = new NodeReference();

	// eslint-disable-next-line valid-jsdoc
	/**
	 * @param {{color: Color, onRemove: Prop<(item: ColorItem) => void>}} props
	 * @memberof PaletteControls
	 */
	async init({color, onRemove}) {
		this.color = color;
		this.onRemove = onRemove;
	}

	static LIST_ITEM_REMOVE_ANIMATION_DURATION = 200;

	async onListItemRemove() {
		// Mark the item as removed
		this.classList.add("removed");

		// Wait for the animation to finish
		this.style.transitionDuration = ColorItem.LIST_ITEM_REMOVE_ANIMATION_DURATION + "ms";
		await timeout(ColorItem.LIST_ITEM_REMOVE_ANIMATION_DURATION);

		// Actually remove the item
		RP(this.onRemove).value(this);
	}

	static COLOR_FORMATS = /**@type {const}*/(["hex", "rgb", "hsl"]);

	async onCopy() {
		// Copy the color to the clipboard
		copyToClipboard(this.color.toString(ColorItem.COLOR_FORMATS[this.format.value], {round: false}));

		// Add a little bit of delay to convince the user some processing is being done
		await timeout(200);

		// Mark the button as copied for some duration of time
		this.copyButton.node.classList.add("copied");
		await timeout(2500);
		this.copyButton.node.classList.remove("copied");
	}

	render() {
		return html`<color-item>
			<div
				class="frame"
				style="background-color: ${this.color.toString("rgb")}"
			></div>
			<code
				class="color"
				title="Click to change the format"
				onclick="${_ => this.format.value = (this.format.value + 1) % ColorItem.COLOR_FORMATS.length}"
			>${this.format.as(v => this.color.toString(ColorItem.COLOR_FORMATS[v], {round: true, precision: 0}))}</code>
			<div class="buttons">
				<button
					ref=${this.copyButton}
					onclick="${_ => this.onCopy()}"
					class="copy"
					title="Copy to clipboard"
				>
					<svg viewBox="0 0 448 512"><path fill="currentColor" d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"></svg>
				</button>
				<button
					onclick="${_ => this.onListItemRemove()}"
					class="remove"
					title="Remove from list"
				>
					<svg viewBox="0 0 448 512"><path fill="currentColor" d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"></svg>
				</button>
		</color-item>`;
	}
}
Component.register(ColorItem);

class MainApp extends Component {
	static tagName = "main-app";

	static MAX_COLORS = 15;

	palette = new Palette(
		new Parameter(0, 0, 0),
		new Parameter(0, 0, 0),
		new Parameter(0, 0, 0),
		new Parameter(0, 0, 0)
	);

	// Trigger for updating the palette (does not hold any actual value)
	trigger = new ReactiveProperty(0);

	avgHue = new ReactiveProperty(0);
	colorBuffer = new ReactiveProperty(new Uint8ClampedArray(0));

	/** @type {NodeReference<PaletteControls>} */
	controls = new NodeReference();

	/** @type {NodeReference<ItemListComponent<Color>>} */
	colorList = new NodeReference();

	async init() {
		// Register click event for adding colors to the list
		window.addEventListener("click", e => {
			// Ignore non-left clicks
			if(e.button !== 0) return;

			const target = /**@type {HTMLElement}*/(e.target);
			if(!target) return;

			// Ignore clicks on UI elements
			if(target.tagName !== "CANVAS" && target.tagName !== "MAIN") return;

			this.onClick(e);
		});

		// Update the URL when the palette changes
		const updateURL = Utils.debounce(_ => this.updateURL(), 500);
		this.subscribeTo(_ => {
			updateURL();
		}, [this.trigger]);
	}

	onMount() {
		// Try to load the palette from the URL
		if(this.readURL()) return;

		// Randomize the palette on mount
		this.controls.node.randomize();
	}

	readURL() {
		const url = new URL(window.location.href);
		const paletteURL = url.searchParams.get("p");
		if(!paletteURL) return false;

		const palette = Palette.fromURL(paletteURL);
		this.palette.a = palette.a;
		this.palette.b = palette.b;
		this.palette.c = palette.c;
		this.palette.d = palette.d;

		this.trigger.update();
		return true;
	}

	updateURL() {
		const url = new URL(window.location.href);
		url.searchParams.set("p", this.palette.toURL());
		window.history.replaceState(null, "", url);
	}

	/**
	 * @param {MouseEvent} e
	 * @memberof MainApp
	 */
	onClick(e) {
		// Get view props
		const {clientX: x} = e;
		const {innerWidth: w} = window;

		// Get buffer props
		const buffer = this.colorBuffer.value;
		const bufferWidth = buffer.length / 4;

		// Calculate UV coordinates
		const u = x / w;

		// Calculate the index of the color
		const index = Math.floor(u * bufferWidth);
		const offset = index * 4;

		// Get the color components
		const r = buffer[offset + 0];
		const g = buffer[offset + 1];
		const b = buffer[offset + 2];

		// Add the color to the list
		const color = new Color(r, g, b);
		this.colorList.node.pushItem(color);

		// Remove the oldest color if the list is full
		if(this.colorList.node.items.length > MainApp.MAX_COLORS) this.colorList.node.deleteItemAt(0);
	}

	render() {
		return html`<main-app>
			<main>
				<header>
					<h1><code>Co(lor+sine)</code> palette generator</h1>
					<p>Generate beautiful color palettes using mathematics!</p>
					<p><small>PRO TIP: Click on the background to add a color to the list</small></p>
				</header>

				${PaletteControls.new({palette: this.palette, trigger: this.trigger, avgHue: this.avgHue, $ref: this.controls})}
				${/**@type {typeof ItemListComponent<Color>}*/(ItemListComponent).new({
					item: (c, l) => ColorItem.new({color: c, onRemove: e => l.deleteItem(e.color)}),
					items: [],
					$ref: this.colorList,
					$attrs: {id: "color-list"}
				})}
			</main>

			${CanvasRenderer.new({palette: this.palette, trigger: this.trigger, avgHue: this.avgHue, colorBuffer: this.colorBuffer})}

			<span class="credits">Concept by <a href="https://www.tiktok.com/@inigoquilez" target="_blank">@inigoquilez</a>.</span>
		</main-app>`;
	}
}
Component.register(MainApp);
