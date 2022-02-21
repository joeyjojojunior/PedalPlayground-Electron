const { ipcRenderer, webFrame } = window.require('electron');
var pedalImagePath = "public/images/pedals/";
var pedalboardImagePath = "public/images/pedalboards/";
var isPedalboardLocked = false;
var isPresetEdited = false;
var isFirstRun = true;
var $draggable = null;
var undoStack = [];
var redoStack = [];
var pedalUnits = "metric";
var pedalboardUnits = "metric";

$(document).ready(function () {
	// Populate Pedalboards and Pedals lists
	GetPedalData();
	GetPedalBoardData();	

	/*
	 * Save/Load pedalboard(s)
	 */
	$("body").on("click", "#save-pedalboard-btn", function (event) {
		savePresetToFile(false);
	})

	$("body").on("click", "#save-as-pedalboard-btn", function (event) {
		savePresetToFile(true);
	})

	$("body").on("click", "#load-pedalboard-btn", function (event) {
		loadPresetFromFile();
	})

	$("body").on('input', ".preset-name", function(event) {
		localStorage["presetName"] = $("#pedalboard-saving .preset-name").val();
		isPresetEdited = true;
		setPedalboardSavingHeader();
	});

	$("body").on("keydown", function (event) {
		if (event.originalEvent.ctrlKey && event.originalEvent.key === "s") {
			savePresetToFile();
		}
	});

	$("body").on("keydown", function (event) {
		if (event.originalEvent.ctrlKey && event.originalEvent.key === "o") {
			loadPresetFromFile();
		}
	});

	/*
	 * Lock pedalboard(s)
	 */
	$("body").on("click", "#lock-pedalboards-btn", function (event) {
		isPedalboardLocked = !isPedalboardLocked;
		localStorage["isPedalboardLocked"] = isPedalboardLocked;
		setPedalboardsLockStatus();
	})

	/*
	 * Undo (Ctrl+Z) & Redo (Ctrl+Y)
	 */
	$("body").on("keydown", function (event) {
		if (event.originalEvent.ctrlKey && event.originalEvent.key === "z") {
 			undo();
		}
	});

	$("body").on("keydown", function (event) {
		if (event.originalEvent.ctrlKey && event.originalEvent.key === "y") {
			redo();
		}
	});


	/*
	 * Copy (Ctrl+C) & Paste (Ctrl+V)
	 */
	$("body").on("keydown", function (event) {
		if (event.originalEvent.ctrlKey && event.originalEvent.key === "c") {
			var selectedObj = $(".canvas .selected")[0];
			if (selectedObj) {
				localStorage.setItem("copiedItem", selectedObj.outerHTML);
				readyCanvas();
				pushToUndoStack();
			}
		}
	});

	$("body").on("keydown", function (event) {
		if (event.originalEvent.ctrlKey && event.originalEvent.key === "v") {
			if (localStorage["copiedItem"]) {
				var copiedItem = document.createElement("div");
				copiedItem.innerHTML = localStorage["copiedItem"];
				var add = copiedItem.firstChild;
				$(".canvas").append(add);
				var addedItemLeftPosition = parseInt(add.style.left);
				add.style.left =  `${addedItemLeftPosition + 50}px`;
				readyCanvas();
				pushToUndoStack();
			}
		}
	});

	/*
	 * Imperial/Metric selection
	 */
	$('input[type=radio][name=pedalboard-radio-units]').on('change', function(e) {
		pedalboardUnits = this.value;
		localStorage["pedalboardUnits"] = pedalboardUnits;

		if (this.value === "metric") {
			$("#pedalboard-custom-width").html("Width <em>(mm)</em>")
			$("#pedalboard-custom-height").html("Height <em>(mm)</em>")
		} else {
			$("#pedalboard-custom-width").html("Width <em>(inches)</em>")
			$("#pedalboard-custom-height").html("Height <em>(inches)</em>")
		}
	});

	
	$('input[type=radio][name=pedal-radio-units]').on('change', function(e) {
		pedalUnits = this.value;
		localStorage["pedalUnits"] = pedalUnits;
		if (this.value === "metric") {
			$("#pedal-custom-width").html("Width <em>(mm)</em>")
			$("#pedal-custom-height").html("Height <em>(mm)</em>")
		} else {
			$("#pedal-custom-width").html("Width <em>(inches)</em>")
			$("#pedal-custom-height").html("Height <em>(inches)</em>")
		}
	});

	/*
	 * Titlebar windowing buttons
	 */
	$(".titlebar-btn-min").on('click', eventMinimizeWindow);
	$(".titlebar-btn-max").on('click', eventMaximizeWindow);
	$(".titlebar-btn-close").on('click', eventCloseWindow);

	// Unset btn focus after click
	$(".btn").mouseup(function(){
		$(this).blur();
	})

	// Make lists searchable
	$(".pedal-list").select2({
		placeholder: "Select a pedal",
		width: "style",
	});

	$(".pedal-list").on("select2:select", function (e) {
		$("#add-selected-pedal").click();
		$(this).trigger("change").focus();
		//$(this).val(null).trigger('change').focus();
	});

	$(".pedalboard-list").select2({
		placeholder: "Select a pedalboard",
		width: "style",
	});

	$(".pedalboard-list").on("select2:select", function (e) {
		$("#add-selected-pedalboard").click();
		$(this).trigger("change").focus();
		//$(this).val(null).trigger('change').focus();
	});

	$(function () {
		// Load canvas from localStorage if it has been saved prior
		if (localStorage["pedalCanvas"] != null) {
			var savedPedalCanvas = JSON.parse(localStorage["pedalCanvas"]);
			$(".canvas").html(savedPedalCanvas);
			readyCanvas();
		}

		// If hidden multiplier value doesn't exist, create it
		if ($("#multiplier").length == 0) {
			$(".canvas").append('<input id="multiplier" type="hidden" value="25">');
			var multiplier = 25;
			// If hidden multiplier value does exist set variable
		} else {
			var multiplier = $("#multiplier").val();
		}
		// Set canvas scale input and bg size to match scale
		$("#canvas-scale").val(multiplier);
		$(".canvas").css("background-size", multiplier + "px");
		
		// Restore desired units
		if (localStorage["pedalboardUnits"] !== null) {
			pedalboardUnits = localStorage["pedalboardUnits"];
			if (pedalboardUnits === "metric") {
				$("#pedalboard-radio-metric").attr('checked', true);
				$("#pedalboard-custom-width").html("Width <em>(mm)</em>")
				$("#pedalboard-custom-height").html("Height <em>(mm)</em>")
			} else {
				$("#pedalboard-radio-imperial").attr('checked', true);
				$("#pedalboard-custom-width").html("Width <em>(inches)</em>")
				$("#pedalboard-custom-height").html("Height <em>(inches)</em>")
			}
		}
		
		if (localStorage["pedalUnits"] !== null) {
			pedalUnits = localStorage["pedalUnits"];
			if (pedalUnits === "metric") {
				$("#pedal-radio-metric").attr('checked', true);
				$("#pedal-custom-width").html("Width <em>(mm)</em>")
				$("#pedal-custom-height").html("Height <em>(mm)</em>")
			} else {
				$("#pedal-radio-imperial").attr('checked', true);
				$("#pedal-custom-width").html("Width <em>(inches)</em>")
				$("#pedal-custom-height").html("Height <em>(inches)</em>")
			}	
		}

		if (localStorage["isPedalboardLocked"] !== null) {
			var isTrueSet = (localStorage["isPedalboardLocked"] === 'true');
			isPedalboardLocked = isTrueSet;
			setPedalboardsLockStatus();
		}	

		if (localStorage["presetName"] !== null) {
			$("#pedalboard-saving .preset-name").val(localStorage["presetName"]);
		}

		if (localStorage["undoStack"] !== null && localStorage["undoStack"] !== undefined) {
			undoStack = JSON.parse(localStorage["undoStack"]);
		}

		if (localStorage["redoStack"] !== null && localStorage["redoStack"] !== undefined) {
			redoStack = JSON.parse(localStorage["redoStack"]);
		}
		
		setTimeout( () => {
			if (localStorage["presetPath"] !== null && localStorage["presetPath"] !== undefined)  {
				ipcRenderer.send('set-preset-path', localStorage["presetPath"]);
			}
		}, 1000);

		if (localStorage["isPresetEdited"] !== null) {
			isPresetEdited = JSON.parse(localStorage["isPresetEdited"]);
		}

		pushToUndoStack();
		isFirstRun = false;
		setPedalboardSavingHeader();
	});

	// When user changes scale, update stuffs
	$("#canvas-scale").change(function () {
		// update var
		var multiplier = $(this).val();
		$("#multiplier").val(multiplier);

		// Update scale of bg image
		$(".canvas").css("background-size", multiplier + "px");

		// Update all items with stored scale
		$(".item").each(function () {
			$(this).attr("data-scale", multiplier);
		});

		// Update regular Pedals
		$(".pedalboard").each(function () {
			var scaledWidth = $(this).data("width") * multiplier;
			var scaledHeight = $(this).data("height") * multiplier;
			$(this).find(".artwork").css("width", scaledWidth).css("height", scaledHeight);
		});

		// Update regular Pedals
		$(".pedal, .pedalboard").each(function () {
			var scaledWidth = $(this).data("width") * multiplier;
			var scaledHeight = $(this).data("height") * multiplier;
			$(this).find(".artwork").css("width", scaledWidth).css("height", scaledHeight);
		});

		// Update custom pedals
		$(".pedal--custom, .pedalboard--custom").each(function () {
			var scaledWidth = $(this).data("width") * multiplier;
			var scaledHeight = $(this).data("height") * multiplier;
			$(this).css("width", scaledWidth).css("height", scaledHeight);
		});
		$(".pedalboard--custom").each(function () {
			var scaledWidth = $(this).data("width") * multiplier;
			var scaledHeight = $(this).data("height") * multiplier;
			$(this).css({
				width: scaledWidth,
				height: scaledHeight,
				borderWidth: multiplier * 0.5,
			});
		});

		savePedalCanvas();
	});

	$("body").on("click", ".sidebar-open", function (e) {
		$(".site-body").addClass("is-slid");
		e.preventDefault();
	});

	$("body").on("click", ".sidebar-close", function (e) {
		$(".site-body").removeClass("is-slid");
		e.preventDefault();
	});

	$("body").on("click", "#clear-canvas-confirmation", function () {
		$(".canvas").empty();
		$("#pedalboard-saving .preset-name").val('') 
		$("#clear-canvas-modal").modal("hide");
		isPedalboardLocked = false;
		localStorage["presetName"] = "";
		localStorage["presetPath"] = null;
		localStorage["isPedalboardLocked"] = null;
		undoStack = [];
		redoStack = [];
		ipcRenderer.send('set-preset-path', '');
		setPedalboardsLockStatus();
		savePedalCanvas();
	});

	$("body").on("click", "#add-pedal button", function (event) {
		var multiplier = $("#canvas-scale").val();
		var serial = GenRandom.Job();
		var selected = $("#add-pedal").find(":selected");
		var name = $(selected).text();
		var shortname = $(selected).attr("id");
		var width = $(selected).data("width");
		var height = $(selected).data("height");
		var scaledWidth = width * multiplier;
		var scaledHeight = height * multiplier;
		var i = $(selected).data("image");
		var pedal =
			'\
<div id="item-' +
			serial +
			'" class="item pedal ' +
			shortname +
			'" title="' +
			name +
			'" data-width="' +
			width +
			'" data-height="' +
			height +
			'" data-scale="' +
			multiplier +
			'">\
	<div class="artwork" style="width:' +
			scaledWidth +
			"px;height:" +
			scaledHeight +
			"px; background-image:url(" +
			pedalImagePath +
			i +
			')"></div>\
	<div class="shadow"></div>\
	<div class="actions">\
		<a class="rotate"></a>\
		<a class="delete"></a>\
	</div>\
</div>';
		$(".canvas").append(pedal);
		readyCanvas();
		pushToUndoStack();
		event.preventDefault();
	});

	$("body").on("click", "#add-pedalboard button", function (event) {
		var serial = GenRandom.Job();
		var multiplier = $("#canvas-scale").val();
		var selected = $("#add-pedalboard").find(":selected");
		var name = $(selected).text();
		var shortname = $(selected).attr("id");
		var width = $(selected).data("width");
		var height = $(selected).data("height");
		var scaledWidth = $(selected).data("width") * multiplier;
		var scaledHeight = $(selected).data("height") * multiplier;
		var i = $(selected).data("image");
		var pedal =
			'\
<div id="item-' +
			serial +
			'" class="item pedalboard ' +
			shortname +
			'" title="' +
			name +
			'" data-width="' +
			width +
			'" data-height="' +
			height +
			'" data-scale="' +
			multiplier +
			'">\
	<div class="artwork" style="width:' +
			scaledWidth +
			"px;height:" +
			scaledHeight +
			"px; background-image:url(" +
			pedalboardImagePath +
			i +
			')"></div>\
	<div class="actions">\
		<a class="rotate"></a>\
		<a class="delete"></a>\
	</div>\
</div>';
		$(".canvas").prepend(pedal);
		pushToUndoStack();
		readyCanvas();
		event.preventDefault();
	});

	// Activate color picker plugin on custom color field
	$(".custom-color-block").colorpicker({
		color: "#41C74D",
	});

	// Add custom pedal
	$("body").on("click", "#add-custom-pedal .btn", function (event) {
		var serial = GenRandom.Job();
		var multiplier = $("#canvas-scale").val();
		var width = (pedalUnits == "metric") ? mmToInch($("#add-custom-pedal .custom-width").val()) : $("#add-custom-pedal .custom-width").val();
		var height = (pedalUnits == "metric") ? mmToInch($("#add-custom-pedal .custom-height").val()) : $("#add-custom-pedal .custom-height").val();
		var scaledWidth = width * multiplier;
		var scaledHeight = height * multiplier;
		var dims = width + '" x ' + height + '"';
		var name = $("#add-custom-pedal .custom-name").val();
		var image = $("#add-custom-pedal .custom-color").val();
		var pedal =
			'\
<div id="item-' +
			serial +
			'" class="item pedal pedal--custom" style="width:' +
			scaledWidth +
			"px;height:" +
			scaledHeight +
			'px;" title="' +
			name +
			'" data-width="' +
			width +
			'" data-height="' +
			height +
			'" data-scale="' +
			multiplier +
			'">\
	<span class="pedal__box" style="background-color:' +
			image +
			';"></span>\
	<span class="pedal__name">' +
			name +
			'</span>\
	<span class="pedal__jack1"></span>\
	<span class="pedal__jack2"></span>\
	<span class="pedal__knob1"></span>\
	<span class="pedal__knob2"></span>\
	<span class="pedal__led"></span>\
	<span class="pedal__switch"></span>\
	<div class="actions">\
		<a class="rotate"></a>\
		<a class="delete"></a>\
	</div>\
</div>';

		$("#add-custom-pedal .invalid").removeClass("invalid");
		var parent = $(pedal).parent();
		if (width == "" || height == "") {
			$("#add-custom-pedal .custom-height, #add-custom-pedal .custom-width").addClass(
				"invalid"
			);
			$("#add-custom-pedal .custom-width").focus();
		} else if (width == "") {
			$("#add-custom-pedal .custom-width").addClass("invalid").focus();
		} else if (height == "") {
			$("#add-custom-pedal .custom-height").addClass("invalid").focus();
		} else {
			console.log("add custom pedal...");
			$(".canvas").append(pedal);
			pushToUndoStack();
			readyCanvas();
			event.preventDefault();
		}
	});

	// Add custom pedalboard
	$("body").on("click", "#add-custom-pedalboard .btn", function (event) {
		var serial = GenRandom.Job();
		var multiplier = $("#canvas-scale").val();
		var width = (pedalboardUnits == "metric") ? mmToInch($("#add-custom-pedalboard .custom-width").val()) : $("#add-custom-pedalboard .custom-width").val();
		var height = (pedalboardUnits == "metric") ? mmToInch($("#add-custom-pedalboard .custom-height").val()) : $("#add-custom-pedalboard .custom-height").val();
		var scaledWidth = width * multiplier;
		var scaledHeight = height * multiplier;

		$("#add-custom-pedalboard .invalid").removeClass("invalid");

		if (width == "" || height == "") {
			$(
				"#add-custom-pedalboard .custom-height, #add-custom-pedalboard .custom-width"
			).addClass("invalid");
			$("#add-custom-pedalboard .custom-width").focus();
		} else if (width == "") {
			$("#add-custom-pedalboard .custom-width").addClass("invalid").focus();
		} else if (height == "") {
			$("#add-custom-pedalboard .custom-height").addClass("invalid").focus();
		} else {
			console.log("add custom pedalboard...");
			var dims = width + '" x ' + height + '"';
			var pedalboard =
				'<div id="item-' +
				serial +
				'" class="item pedalboard pedalboard--custom" style="width:' +
				scaledWidth +
				"px;height:" +
				scaledHeight +
				"px; border-width:" +
				multiplier / 2 +
				'px" title="Custom Pedalboard" data-width="' +
				width +
				'" data-height="' +
				height +
				'" data-scale="' +
				multiplier +
				'">\
			<div class="actions">\
			<a class="delete"></a>\
			<a class="rotate"></a>\
			</div>\
			</div>';

			$(".canvas").prepend(pedalboard);
			pushToUndoStack();
			readyCanvas();
			event.preventDefault();
		}
	});

	// On keydown of "Delete" remove pedal
	$("body").on("keydown keyup", function (event) {
		var selectedObj = $(".canvas .selected")[0];		
		if (selectedObj && !(selectedObj.classList.contains("pedalboard") && isPedalboardLocked)) {
			if (event.which == 46) {
				deleteSelected();
				$(".site-body > .panel").remove();
				savePedalCanvas();
			}
		}
	});

	// On keydown of "[", move bedal back
	$("body").on("keydown keyup", function (event) {
		var selectedObj = $(".canvas .selected")[0];
		if (selectedObj && !(selectedObj.classList.contains("pedalboard") && isPedalboardLocked)) {
			if (event.which == 219) {
				$(".panel a[href='#back']").click();
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});

	// On keydown of "]", move bedal front
	$("body").on("keydown keyup", function (event) {
		var selectedObj = $(".canvas .selected")[0];
		if (selectedObj && !(selectedObj.classList.contains("pedalboard") && isPedalboardLocked)) {
			if (event.which == 221) {
				$(".panel a[href='#front']").click();
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});

	// 37 - left
	// 38 - up
	// 39 - right
	// 40 - down

	// Move left
	$("body").on("keydown", function (event) {
		if (event.which == 37) {
			var pedalboard = $(".canvas .pedalboard")[0];
			if (pedalboard && !(pedalboard.classList.contains("pedalboard") && isPedalboardLocked)) {
				$($(".item"), $(".canvas")).each(function(){
					var current = parseInt($(this).css("left"));
					$(this).css("left", current - 1);
				})
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});

	// Move up
	$("body").on("keydown", function (event) {
		if (event.which == 38) {
			var pedalboard = $(".canvas .pedalboard")[0];
			if (pedalboard && !(pedalboard.classList.contains("pedalboard") && isPedalboardLocked)) {
				$($(".item"), $(".canvas")).each(function(){
					var current = parseInt($(this).css("top"));
					$(this).css("top", current - 1);
				})
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});

	// Move right
	$("body").on("keydown", function (event) {
		if (event.which == 39) {
			var pedalboard = $(".canvas .pedalboard")[0];
			if (pedalboard && !(pedalboard.classList.contains("pedalboard") && isPedalboardLocked)) {
				$($(".item"), $(".canvas")).each(function(){
					var current = parseInt($(this).css("left"));
					$(this).css("left", current + 1);
				})
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});

	// Move down
	$("body").on("keydown", function (event) {
		if (event.which == 40) {
			var pedalboard = $(".canvas .pedalboard")[0];
			if (pedalboard && !(pedalboard.classList.contains("pedalboard") && isPedalboardLocked)) {
				$($(".item"), $(".canvas")).each(function(){
					var current = parseInt($(this).css("top"));
					$(this).css("top", current + 1);
				})
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});

	$("body").on("keydown", function (event) {
		event.stopPropagation();

		//mvital: in some cases click event is sent multiple times to the handler - no idea why
		//mvital: seems calling stopImmediatePropagation() helps
		event.stopImmediatePropagation();

		var selectedObj = $(".canvas .selected")[0];
		if (selectedObj && !(selectedObj.classList.contains("pedalboard") && isPedalboardLocked)) {
			if (event.which == 82) {
				if ($(".canvas .selected").hasClass("rotate-90")) {
					$(".canvas .selected").removeClass("rotate-90");
					$(".canvas .selected").addClass("rotate-180");
				} else if ($(".canvas .selected").hasClass("rotate-180")) {
					$(".canvas .selected").removeClass("rotate-180");
					$(".canvas .selected").addClass("rotate-270");
				} else if ($(".canvas .selected").hasClass("rotate-270")) {
					$(".canvas .selected").removeClass("rotate-270");
				} else {
					$(".canvas .selected").addClass("rotate-90");
				}
				pushToUndoStack();
				savePedalCanvas();
			}
		}
	});
}); // End Document ready




/*
 * Save/Load pedalboard(s)
 */
function savePresetToFile(isSaveAs) {
	var preset = {
		name: $("#pedalboard-saving .preset-name").val(),
		isPedalboardLocked: isPedalboardLocked,
		canvasScale: $("#canvas-scale").val(),
		canvas: JSON.stringify($(".canvas").html())
	};
	ipcRenderer.send('save-preset', JSON.stringify(preset), isSaveAs);
}

ipcRenderer.on('save-preset-saved', (event, presetPath) => {
	localStorage["presetPath"] = presetPath;
	isPresetEdited = false;
	isFirstRun = false;
	setPedalboardSavingHeader();
});

function loadPresetFromFile(e) {
	ipcRenderer.send('load-preset');
}

ipcRenderer.on('load-preset-loaded', (event, preset, presetPath) => {
	var presetJSON = JSON.parse(preset);
	$("#pedalboard-saving .preset-name").val(presetJSON.name); 
	isPedalboardLocked = presetJSON.isPedalboardLocked;
	$("#canvas-scale").val(presetJSON.canvasScale);
	$(".canvas").html(JSON.parse(presetJSON.canvas));
	undoStack = [];
	redoStack = [];
	localStorage["presetName"] = $("#pedalboard-saving .preset-name").val();
	localStorage["presetPath"] = presetPath;
	isPresetEdited = false;
	isFirstRun = true;
	pushToUndoStack();
	isFirstRun = false;
	readyCanvas();
	savePedalCanvas();
	setPedalboardsLockStatus();
	setPedalboardSavingHeader();
});


/*
 * Undo/Redo
 */
function undo() {
	if (undoStack.length > 1) {
		redoStack.push(this.undoStack.pop());
		$(".canvas").html(JSON.parse(this.undoStack[this.undoStack.length-1]));
		readyCanvas();
		savePedalCanvas();
	} 
	
	if (undoStack.length === 1) {
		isPresetEdited = false;
		setPedalboardSavingHeader();
	}

	if (undoStack.length > 100000) {
		undoStack = undoStack.slice(-Math.ceil(undoStack.length / 2));
	}
}

function pushToUndoStack() {
	console.log($(".pedalboard-saving-header"));
	if (!isFirstRun) {
		console.log("undo stack not first run");
		isPresetEdited = true;
		setPedalboardSavingHeader();
	}
	undoStack.push(JSON.stringify($(".canvas").html()));
}

function redo() {
	if (redoStack.length > 0) {
		var redoState = this.redoStack.pop();
		this.undoStack.push(redoState);
		$(".canvas").html(JSON.parse(redoState));
		readyCanvas();
		savePedalCanvas();
	}

	if (redoStack.length > 1) {
		isPresetEdited = true;
		setPedalboardSavingHeader();
	}

	if (redoStack.length > 100000) {
		redoStack = redoStack.slice(-Math.ceil(redoStack.length / 2));
	}
}

function setPedalboardSavingHeader() {
	console.log("ipe: " + isPresetEdited);
	if (isPresetEdited) {
		$(".pedalboard-saving-header").css("color", "red");
		$(".pedalboard-saving-header").html("Pedalboard Saving (Unsaved)");
	} else {
		console.log("here");
		$(".pedalboard-saving-header").css("color", "black");
		$(".pedalboard-saving-header").html("Pedalboard Saving");
	}
	
}

/*
 * Lock or unlock pedalboard(s)
 */
function setPedalboardsLockStatus() {
	let lockBtn = $("#lock-pedalboards-btn")[0];
	if (isPedalboardLocked) {
		lockBtn.innerHTML = "Unlock Boards"
		lockBtn.classList.remove("btn-primary");
		lockBtn.classList.add("btn-danger");
	} else {
		lockBtn.innerHTML = "Lock Boards"
		lockBtn.classList.add("btn-primary");
		lockBtn.classList.remove("btn-danger");
	}

	var isEnabled = !isPedalboardLocked ? "enable" : "disable";
	if ($draggable) {
		$draggable.filter( function( i, elem ) {
			return elem.classList.contains("pedalboard");
		}).draggabilly(isEnabled);
	}	
}

/*
 * Titlebar windowing button actions
 */
function eventMinimizeWindow() {
	ipcRenderer.send('window-minimize');
}

function eventMaximizeWindow() {
	ipcRenderer.send('window-maximize');
}

function eventCloseWindow() {
	localStorage["isPresetEdited"] = isPresetEdited;
	localStorage["undoStack"] = JSON.stringify(undoStack);
	localStorage["redoStack"] = JSON.stringify(redoStack);
	ipcRenderer.send('window-close');
}


function mmToInch(mm) {
	return parseInt(mm, 10)/25.4;
}












function readyCanvas(pedal) {
	$draggable = $(".canvas .pedal, .canvas .pedalboard").draggabilly({
		containment: ".canvas",
	});

	/*
	$(".canvas .pedal, .canvas .pedalboard").draggabilly({
		containment: ".canvas",
	});
	*/

	$draggable.on("dragEnd", function (e) {
		pushToUndoStack();
		savePedalCanvas();
	});

	$draggable.on("staticClick", function (event) {
		console.log("click");
		//rotatePedal(this);
		var target = $(event.target);
		console.log(target);
		if (target.is(".delete")) {
			deletePedal(this);
			deselect();
			$("body").click();
		} else if (target.is(".rotate")) {
			event.stopPropagation();

			//mvital: in some cases click event is sent multiple times to the handler - no idea why
			//mvital: seems calling stopImmediatePropagation() helps
			event.stopImmediatePropagation();

			//rotatePedal(this);
			if ($(this).hasClass("rotate-90")) {
				$(this).removeClass("rotate-90");
				$(this).addClass("rotate-180");
			} else if ($(this).hasClass("rotate-180")) {
				$(this).removeClass("rotate-180");
				$(this).addClass("rotate-270");
			} else if ($(this).hasClass("rotate-270")) {
				$(this).removeClass("rotate-270");
			} else {
				$(this).addClass("rotate-90");
			}
			pushToUndoStack();
			savePedalCanvas();
		} 
	});

	savePedalCanvas();
}

function savePedalCanvas() {
	//console.log("Canvas Saved!");
	localStorage["pedalCanvas"] = JSON.stringify($(".canvas").html());
}

/*
function rotatePedal(pedal) {
	if ($(pedal).hasClass("rotate-90")) {
		$(pedal).removeClass("rotate-90");
		$(pedal).addClass("rotate-180");
	} else if ($(pedal).hasClass("rotate-180")) {
		$(pedal).removeClass("rotate-180");
		$(pedal).addClass("rotate-270");
	} else if ($(pedal).hasClass("rotate-270")) {
		$(pedal).removeClass("rotate-270");
	} else {
		$(pedal).addClass("rotate-90");
	}
	savePedalCanvas();
}
*/

function deletePedal(pedal) {
	console.log("delete pedal")
	$(pedal).remove();
	deselect();
	pushToUndoStack();
	savePedalCanvas();
}

function deselect() {
	console.log("deselect");
	$(".canvas .panel").remove();
	$(".canvas .selected").removeClass("selected");
	savePedalCanvas();
}

function deleteSelected() {
	pushToUndoStack();

	$(".canvas .selected").remove();
	$(".canvas .panel").remove();
	savePedalCanvas();

}

// function rotatePedal() {
// 	alert("rotate Pedal");
// 	if ( $(this).hasClass("rotate-90") ) {
// 		$(this).removeClass("rotate-90");
// 		$(this).addClass("rotate-180");
// 	} else if ( $(this).hasClass("rotate-180") ) {
// 		$(this).removeClass("rotate-180");
// 		$(this).addClass("rotate-270");
// 	}  else if ( $(this).hasClass("rotate-270") ) {
// 		$(this).removeClass("rotate-270");
// 	} else {
// 		$(this).addClass("rotate-90");
// 	}
// 	return false;
// }

window.Pedal = function (type, brand, name, width, height, image) {
	this.Type = type || "";
	this.Brand = brand || "";
	this.Name = name || "";
	this.Width = width || "";
	this.Height = height || "";
	this.Image = image || "";
};

window.GetPedalData = function () {
	// console.log('GetPedalData');
	$.ajax({
		url: "public/data/pedals.json",
		dataType: "text",
		type: "GET",
		success: function (data) {
			data = $.parseJSON(data.replace(/\r\n/g, "").replace(/\t/g, ""));
			var pedals = [];
			for (var pedal in data) {
				pedals.push(
					new Pedal(
						data[pedal].Type || "",
						data[pedal].Brand || "",
						data[pedal].Name || "",
						data[pedal].Width || "",
						data[pedal].Height || "",
						data[pedal].Image || ""
					)
				);
			}
			//Sort brands and pedals alphabetically
			pedals.sort(function (a, b) {
				if (a.Brand < b.Brand) {
					return -1;
				} else if (b.Brand < a.Brand) {
					return 1;
				} else {
					if (a.Name < b.Name) {
						return -1;
					} else if (b.Name < a.Name) {
						return 1;
					}
					return 0;
				}
			});
			pedals.forEach(RenderPedals);
			listPedals(pedals);
		},
	});
};

window.RenderPedals = function (pedals) {
	var { Type, Brand, Name, Width, Height, Image } = pedals;
	var option = $("<option>", {
		text: `${Brand} ${Name}`,
		// id: `${Name.toLowerCase().replace(/(\s+)|(['"])/g, (m, p1, p2) => p1 ? "-" : "")}`,
		data: {
			width: Width,
			height: Height,
			image: Image,
		},
	});
	if ($("optgroup").is(`[label="${Brand}"]`)) {
		$(`optgroup[label="${Brand}"]`).append(option);
	} else {
		$("<optgroup>", {
			label: Brand,
			html: option,
		}).appendTo(".pedal-list");
	}
};

window.PedalBoard = function (brand, name, width, height, image) {
	this.Brand = brand || "";
	this.Name = name || "";
	this.Width = width || "";
	this.Height = height || "";
	this.Image = image || "";
};

window.GetPedalBoardData = function () {
	// console.log('GetPedalBoardData');
	$.ajax({
		url: "public/data/pedalboards.json",
		dataType: "text",
		type: "GET",
		success: function (data) {
			data = $.parseJSON(data.replace(/\r\n/g, "").replace(/\t/g, ""));
			var pedalboards = [];
			for (var pedalboard in data) {
				pedalboards.push(
					new PedalBoard(
						data[pedalboard].Brand || "",
						data[pedalboard].Name || "",
						data[pedalboard].Width || "",
						data[pedalboard].Height || "",
						data[pedalboard].Image || ""
					)
				);
			}
			console.log("Pedalboard data loaded");
			//Sort brands and pedals alphabetically
			pedalboards.sort(function (a, b) {
				if (a.Brand < b.Brand) {
					return -1;
				} else if (b.Brand < a.Brand) {
					return 1;
				} else {
					if (a.Name < b.Name) {
						return -1;
					} else if (b.Name < a.Name) {
						return 1;
					}
					return 0;
				}
			});
			RenderPedalBoards(pedalboards);
		},
	});
};

window.RenderPedalBoards = function (pedalboards) {
	// console.log('RenderPedalBoards');
	for (var i in pedalboards) {
		// var $pedalboard = $("<option>"+ pedalboards[i].Brand + " " + pedalboards[i].Name +"</option>").attr('id', pedalboards[i].Name.toLowerCase().replace(/\s+/g, "-").replace(/'/g, ''));
		var $pedalboard = $(
			"<option>" + pedalboards[i].Brand + " " + pedalboards[i].Name + "</option>"
		);
		$pedalboard.data("width", pedalboards[i].Width);
		$pedalboard.data("height", pedalboards[i].Height);
		$pedalboard.data("height", pedalboards[i].Height);
		$pedalboard.data("image", pedalboards[i].Image);
		$pedalboard.appendTo(".pedalboard-list");
	}
};

// List pedals on page to find errors
window.listPedals = function (pedals) {
	if ($("#list-pedals").length) {
		// console.log('List pedals...');
		for (var i in pedals) {
			multiplier = 40;
			Width = pedals[i].Width * multiplier;
			Height = pedals[i].Height * multiplier;

			var $pedalListing = $(
				'<div class="pedal-listing">\
				<img src="' +
					pedalImagePath +
					pedals[i].Image +
					'" alt="' +
					pedals[i].Brand +
					" " +
					pedals[i].Name +
					'" width="' +
					Width +
					'" height="' +
					Height +
					'"/>\
				<p class="pedal-brand">' +
					pedals[i].Brand +
					'</p>\
				<p class="pedal-name">' +
					pedals[i].Name +
					"</p>\
			</div>"
			);
			// $pedalListing.css('width', pedals[i].Width);
			// $pedalListing.css('height', pedals[i].Height);
			// $pedalListing.css('background-image', "url(" + pedals[i].Image + ")" );
			$pedalListing.appendTo("#list-pedals");
		}
	}
};

var GenRandom = {
	Stored: [],
	Job: function () {
		var newId = Date.now().toString().substr(3); // or use any method that you want to achieve this string
		if (!this.Check(newId)) {
			this.Stored.push(newId);
			return newId;
		}
		return this.Job();
	},
	Check: function (id) {
		for (var i = 0; i < this.Stored.length; i++) {
			if (this.Stored[i] == id) return true;
		}
		return false;
	},
};

$("body").on("click", ".item", function (e) {
	var pedal = $(this);
	var id = $(this).attr("id");
	var selectedObj = $(pedal)[0];	
	var pedalName = $(this).attr("title");
	var width = $(this).attr("data-width");
	var height = $(this).attr("data-height");

	let panel = "";
	if (selectedObj.classList.contains("pedalboard") && isPedalboardLocked) {
		panel = ')</span>\<div class="panel_action panel-action-locked">Pedalboard locked.</div>';
	} else if (selectedObj.classList.contains("pedal--custom")) {
		panel = ')</span>\
		</div>\
			<a href="#rename" class="panel__action">Rename <i>D</i></a>\
			<a href="#rotate" class="panel__action">Rotate <i>R</i></a>\
			<a href="#front" class="panel__action">Move Front <i>]</i></a>\
			<a href="#back" class="panel__action">Move Back <i>[</i></a>\
			<a href="#delete" class="panel__action">Delete <i>D</i></a>\
		</div>';	
	} else {
		panel = ')</span>\
		</div>\
			<a href="#rotate" class="panel__action">Rotate <i>R</i></a>\
			<a href="#front" class="panel__action">Move Front <i>]</i></a>\
			<a href="#back" class="panel__action">Move Back <i>[</i></a>\
			<a href="#delete" class="panel__action">Delete <i>D</i></a>\
		</div>';
	}

	var markup =
		'<div class="panel" data-id="#' +
		id +
		'">\
    <div class="panel__name">' +
		pedalName +
		'<br><span class="panel__dimensions">(' +
		width +
		" x " +
		height +
		panel;

	// reset stuff
	$(".panel").remove();
	$(".canvas .selected").removeClass("selected");

	// add stuff
	$(pedal).addClass("selected");

	$(".canvas").after(markup);

	// Prevent bubble up to .canvas
	e.stopPropagation();
});

$("body").on("mousedown", ".item", function(e) {
	if (e.which === 3) {
		$($(".item"), $(".canvas")).each(function() {
			$(this).addClass("selected");
		})
	}
	e.stopPropagation();
})

$("body").on("click", 'a[href="#rename"]', function () {
	e.stopImmediatePropagation();
	$("#rename-pedal-modal").modal("show");
	var id = $(this).parents(".panel").data("id");
	$(id).addClass("pedal-renaming")
	var pedalName = $(id).find(".pedal__name").html();
	$(".rename-pedal-modal-input").val(pedalName);
});

$("body").on("click", "#rename-pedal-confirmation", function () {
	e.stopImmediatePropagation();
	var newPedalName = $(".rename-pedal-modal-input").val();
	var renamedPedal = $(".pedal-renaming").find(".pedal__name");
	renamedPedal.html(newPedalName);
	$(".pedal-renaming").removeClass("pedal-renaming");
	$("#rename-pedal-modal").modal("hide");
});

$("body").on("click", 'a[href="#rotate"]', function (e) {
	e.stopPropagation();
	e.stopImmediatePropagation();

	var id = $(this).parents(".panel").data("id");

	if ($(id).hasClass("rotate-90")) {
		$(id).removeClass("rotate-90");
		$(id).addClass("rotate-180");
	} else if ($(id).hasClass("rotate-180")) {
		$(id).removeClass("rotate-180");
		$(id).addClass("rotate-270");
	} else if ($(id).hasClass("rotate-270")) {
		$(id).removeClass("rotate-270");
	} else {
		$(id).addClass("rotate-90");
	}
	savePedalCanvas();
});

$("body").on("click", 'a[href="#delete"]', function () {
	var id = $(this).parents(".panel").data("id");
	$(id).remove();
	$(".panel").remove();
	savePedalCanvas();
});

$("body").on("click", 'a[href="#front"]', function (e) {
	e.stopImmediatePropagation();
	var id = $(this).parents(".panel").data("id");
	$(id).next().insertBefore(id);
	savePedalCanvas();
	e.stopPropagation();
});

$("body").on("click", 'a[href="#back"]', function (e) {
	e.stopImmediatePropagation();
	var id = $(this).parents(".panel").data("id");
	$(id).prev().insertAfter(id);
	savePedalCanvas();
	e.stopPropagation();
});

$("body").click(function () {
	// reset stuff
	$(".panel").remove();
	$(".canvas .selected").removeClass("selected");
});
