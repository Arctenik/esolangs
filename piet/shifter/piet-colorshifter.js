
const programInp = document.getElementById("programInp");
const hueInp = document.getElementById("hueInp");
const lightnessInp = document.getElementById("lightnessInp");
const scaleInp = document.getElementById("scaleInp");
const dlButton = document.getElementById("dlButton");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let inputFileName;
let sourceImage;
let image;

makeNumberInpWrap(hueInp, 6, updateProgram);
makeNumberInpWrap(lightnessInp, 3, updateProgram);

function makeNumberInpWrap(inp, mod, extraCallback) {
	inp.addEventListener("change", () => {
		inp.value = ((+inp.value)%mod + mod)%mod;
		if (extraCallback) extraCallback();
	});
}

scaleInp.addEventListener("change", () => updateScale());

programInp.addEventListener("change", loadProgram);

dlButton.addEventListener("click", () => {
	const a = document.createElement("a");
	a.download = inputFileName.replace(/\.|$/, "_shifted$&");
	a.href = canvas.toDataURL();
	a.dispatchEvent(new MouseEvent("click"));
});

async function loadProgram() {
	inputFileName = programInp.files[0].name;
	sourceImage = await new PNG().parse(await programInp.files[0].arrayBuffer());
	image = new ImageData(new Uint8ClampedArray(sourceImage.data), sourceImage.width);
	showProgram();
}

function updateProgram() {
	const dh = +hueInp.value;
	const dl = +lightnessInp.value;
	for (let i = 0; i < sourceImage.data.length; i += 4) {
		if (sourceImage.data[i + 3] === 255) {
			const values = sourceImage.data.slice(i, i + 3);
			if (new Set(sourceImage.data.slice(i, i + 3)).size === 2) {
				const min = Math.min(...values);
				const max = Math.max(...values);
				if ((min === 0 || min === 192) && (max === 192 || max === 255)) {
					let h = values[0] === max && values[2] === max ? 5 : values.indexOf(max) + values.lastIndexOf(max);
					let l = max === 192 ? 0 : min === 192 ? 2 : 1;
					h = (h + dh)%6;
					l = (l + dl)%3;
					const rmin = l === 2 ? 192 : 0;
					const rmax = l === 0 ? 192 : 255;
					image.data[i] = rmin;
					image.data[i + 1] = rmin;
					image.data[i + 2] = rmin;
					image.data[i + Math.floor(h/2)] = rmax;
					image.data[i + Math.ceil(h/2)%3] = rmax;
				}
			}
		}
	}
	
	showProgram();
}

function showProgram() {
	canvas.width = image.width;
	canvas.height = image.height;
	ctx.putImageData(image, 0, 0);
	updateScale();
}

function updateScale() {
	canvas.style.width = (canvas.width * scaleInp.value) + "px";
}


if (programInp.files.length) loadProgram();
