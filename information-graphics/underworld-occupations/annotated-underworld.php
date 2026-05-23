<?php
$page_title = 'Annotated Underworld - Municipal Sky';
$page_description = 'Literary excerpt with annotations';
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+DW+Pica:ital@0;1&family=IM+Fell+English+SC&display=swap" rel="stylesheet">

<link rel="stylesheet" href="annotated-underworld.css">

<style>
/* New Legend Styles for Major Groups Chart */
.major-groups-legend {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 24px; /* Increased gap for better spacing */
  margin-bottom: 20px; /* Was on the <p> tag */
  font-family: "IM Fell DW Pica", serif;
  color: #4a2c2a;
  font-size: 1rem;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend-color-box {
  width: 30px;
  height: 12px;
  border: 1px solid #4a2c2a;
  opacity: 0.7;
}
.legend-label {
  font-family: "IM Fell DW Pica", serif;
  font-size: 14px;
  color: #4a2c2a;
}

/* --- MODIFICATION: Reduce bottom margin on bar chart container --- */
.major-groups-container {
    margin-bottom: 20px !important;
}

/* --- MODIFICATION: Updated wage-tooltip width --- */
.wage-tooltip {
  position: absolute;
  /* visibility: hidden; */ /* Switched to display */
  display: none; /* Use display to prevent layout shift */
  padding: 10px 15px;
  background-color: #d4c4a0;
  background-image: linear-gradient(
    135deg,
    rgba(220, 200, 160, 0.3) 25%,
    transparent 25%,
    transparent 50%,
    rgba(220, 200, 160, 0.3) 50%,
    rgba(220, 200, 160, 0.3) 75%,
    transparent 75%,
    transparent
  );
  background-size: 4px 4px;
  border: 3px double #c84034;
  border-radius: 3px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  font-family: "IM Fell DW Pica", serif;
  font-size: 14px;
  color: #2a2019;
  pointer-events: none;
  z-index: 10000;
  text-align: left;
  white-space: normal;
  /* max-width: 250px; */ /* Removed max-width */
  /* width: max-content; */ /* Removed max-content */
  width: 360px; /* Set fixed width to match annotation tooltips */
}

/* --- MODIFICATION: Added style for tooltip header with divider --- */
.wage-tooltip .tooltip-header {
  font-weight: 600;
  font-family: "IM Fell English SC", serif;
  font-size: 15px;
  margin-bottom: 8px;
  display: block;
  border-bottom: 2px solid #c84034; /* The red line */
  padding-bottom: 6px;
  color: #1a1410;
  text-align: center;
}

</style>

<div class="main-wrapper">
<div class="content-frame">

<div class="post-container">
<header class="text-center">
<h1>Annotated Underworld</h1>
</header>
</div>

<div class="post-container">
<div class="wage-distribution-container">
<h2>Distribution of Annual Wages Across U.S. Occupations</h2>
<p>Weighted by workforce share • Based on Bureau of Labor Statistics data</p>
<div id="wage-distribution-viz"></div>
</div>
</div>


<div class="post-container">
<div class="major-groups-container">

<h2>Comparing the distribution of major occupational groups</h2>


<div class="major-groups-legend">
    <div class="legend-item">
        <span class="legend-color-box" style="background-color: #c84034;"></span>
        <span class="legend-label">Underworld</span>
    </div>
    <div class="legend-item">
        <span class="legend-color-box" style="background-color: #4a7ba7;"></span>
        <span class="legend-label">US Workforce</span>
    </div>
</div>

<div id="major-groups-viz"></div>
</div>
</div>

<div class="post-container">
<div class="passage-excerpt" id="rabelais-passage">
<p>Xerxes was a crier of mustard. Romulus, a salter and patcher of pattens. Numa, a nailsmith. Tarquin,
a porter. Piso, a clownish swain. Sylla, a ferryman. Cyrus, a cowherd. Themistocles, a glass-maker.
Epaminondas, a maker of mirrors or looking-glasses. Brutus and Cassius, surveyors or measurers of
land. Demosthenes, a vine-dresser. Cicero, a fire-kindler. Fabius, a threader of beads. Artaxerxes,
a rope-maker. Aeneas, a miller. Achilles was a scaldpated maker of hay-bundles. Agamemnon, a
lick-box. Ulysses, a hay-mower. Nestor, a door-keeper or forester. Darius, a gold-finder or
jakes-farmer. Ancus Martius, a ship-trimmer. Camillus, a foot-post. Marcellus, a sheller of beans.
Drusus, a taker of money at the doors of playhouses. Scipio Africanus, a crier of lee in a wooden
slipper. Asdrubal, a lantern-maker. Hannibal, a kettlemaker and seller of eggshells. Priamus, a
seller of old clouts. Lancelot of the Lake was a flayer of dead horses.</p>
<div class="passage-attribution">
From <em>Gargantua and Pantagruel</em> by François Rabelais (Book II, Chapter 30)
</div>
</div>
</div>

</div>
</div>

<script src="https://d3js.org/d3.v7.min.js"></script>

<script>
document.addEventListener('DOMContentLoaded', function () {
fetch('../api/rabelais-annotations.php')
.then(response => response.json())
.then(data => {
if (data.success) {
// Call Histogram
if (data.wage_distribution && data.total_employment) {
createHistogramPlot(data.wage_distribution, data.total_employment, data.characters);
}

// Call Major Groups Comparison (RE-ADDED)
if (data.major_group_employment && data.characters) {
createMajorGroupsComparison(data.major_group_employment, data.characters);
}

// Highlight names in text
if (data.characters && data.characters.length > 0) {
highlightNames(data.characters);
}
} else {
console.error('No data returned from API');
}
})
.catch(error => {
console.error('Error loading data:', error);
});
});

function createHistogramPlot(occupations, totalEmployment, rabelaisCharacters) {
const container = d3.select('#wage-distribution-viz');
const containerNode = container.node();
if (!containerNode) return;
const width = containerNode.clientWidth;
const height = 500;
const margin = { top: 20, right: 40, bottom: 60, left: 70 };
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;

const histHeight = plotHeight * 0.60;
const boxplotSpace = 15;
const stripHeight = plotHeight - histHeight - boxplotSpace;
const stripTop = histHeight + boxplotSpace;

container.selectAll('*').remove();

const svg = container.append('svg')
.attr('width', width)
.attr('height', height);
const defs = svg.append('defs');

const filter = defs.append('filter').attr('id', 'wobble');
filter.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.03').attr('numOctaves', '1').attr('result', 'turbulence');
filter.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'turbulence').attr('scale', '2');

const textureFilter = defs.append('filter').attr('id', 'parchment-texture-filter')
.attr('x','0%').attr('y','0%').attr('width','100%').attr('height','100%');
textureFilter.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.02 0.05').attr('numOctaves', '2').attr('result', 'noise');
textureFilter.append('feColorMatrix').attr('type', 'matrix').attr('values', `0 0 0 0 0.827 0 0 0 0 0.768 0 0 0 0 0.627 0 0 0 0.3 0`);

const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

g.append('rect').attr('x', 0).attr('y', 0).attr('width', plotWidth).attr('height', plotHeight).attr('fill', '#f0e8d8');
g.append('rect').attr('x', 0).attr('y', 0).attr('width', plotWidth).attr('height', plotHeight).style('filter', 'url(#parchment-texture-filter)');
const data = occupations.map(d => ({
wage: parseFloat(d.A_MEAN),
employment: parseFloat(d.TOT_EMP),
})).filter(d => !isNaN(d.wage) && !isNaN(d.employment) && d.wage > 0 && d.employment > 0);

const wageExtent = d3.extent(data, d => d.wage);
if(!wageExtent[0] || !wageExtent[1]) {
console.error("Wage data is invalid, cannot draw chart.");
return;
}

const xScale = d3.scaleLog().domain(wageExtent).range([0, plotWidth]);
const thresholds = xScale.ticks(40);
const bins = [];
for (let i = 0; i < thresholds.length - 1; i++) {
bins.push({ x0: thresholds[i], x1: thresholds[i+1], employment: 0, occupationCount: 0 });
}

data.forEach(d => {
for (let bin of bins) {
if (d.wage >= bin.x0 && d.wage < bin.x1) {
bin.employment += d.employment;
bin.occupationCount += 1;
break;
}
}
});

const yMax = d3.max(bins, d => d.employment);
const yScaleHist = d3.scaleLinear().domain([0, yMax]).range([histHeight, 0]).nice();

// --- MODIFICATION: Use style('display', 'none') instead of visibility ---
const tooltip = d3.select('body').append('div').attr('class', 'wage-tooltip').style('position', 'absolute').style('display', 'none');

const gridValues = [20000, 30000, 50000, 75000, 100000, 150000, 250000, 400000];
g.append('g').attr('class', 'grid-vertical').selectAll('line')
.data(gridValues.filter(v => v >= xScale.domain()[0] && v <= xScale.domain()[1]))
.enter().append('line')
.attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
.attr('y1', 0).attr('y2', plotHeight);

g.append('g').attr('class', 'grid').call(d3.axisLeft(yScaleHist).tickSize(-plotWidth).tickFormat(''));

g.selectAll(".histogram-bar").data(bins).enter().append("rect")
.attr("class", "histogram-bar")
.attr("x", d => xScale(d.x0))
.attr("y", d => yScaleHist(d.employment))
.attr("width", d => xScale(d.x1) - xScale(d.x0))
.attr("height", d => histHeight - yScaleHist(d.employment))
.attr('filter', 'url(#wobble)')
.on('mouseover', function (event, d) {
const percentOfTotal = (d.employment / totalEmployment * 100).toFixed(2);
// --- MODIFICATION: Use style('display', 'block') ---
tooltip.style('display', 'block').html(`<strong>Wage Range:</strong> $${Math.round(d.x0).toLocaleString()} - $${Math.round(d.x1).toLocaleString()}<br/><strong>Total Employment:</strong> ${Math.round(d.employment).toLocaleString()}<br/><strong>Share of Workforce:</strong> ${percentOfTotal}%<br/><strong>Occupations in Bin:</strong> ${d.occupationCount}`);
})
.on('mousemove', (event) => tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px'))
// --- MODIFICATION: Use style('display', 'none') ---
.on('mouseout', () => tooltip.style('display', 'none'));

const underworldLaborers = rabelaisCharacters
.filter(c => c.detailed_a_mean && !isNaN(parseFloat(c.detailed_a_mean)))
.map(c => ({ name: c.name, labor: c.labor, wage: parseFloat(c.detailed_a_mean), occTitle: c.occ_title, description: c.description }));

const sortedData = data.slice().sort((a, b) => a.wage - b.wage);
function getWeightedPercentile(sortedData, percentile) {
const target = totalEmployment * percentile; let cumulative = 0;
for (let i = 0; i < sortedData.length; i++) { cumulative += sortedData[i].employment; if (cumulative >= target) return sortedData[i].wage; }
return sortedData[sortedData.length - 1].wage;
}
const usStats = { min: sortedData[0].wage, q1: getWeightedPercentile(sortedData, 0.25), median: getWeightedPercentile(sortedData, 0.50), q3: getWeightedPercentile(sortedData, 0.75), max: sortedData[sortedData.length - 1].wage };

const boxplotGap = 15, boxHeight = 12, usBoxY = histHeight + boxplotGap;
const usColor = '#4a2c2a';
g.append('line').attr('x1', xScale(usStats.min)).attr('x2', xScale(usStats.q1)).attr('y1', usBoxY + boxHeight / 2).attr('y2', usBoxY + boxHeight / 2).attr('stroke', usColor).attr('stroke-width', 1);
g.append('line').attr('x1', xScale(usStats.q3)).attr('x2', xScale(usStats.max)).attr('y1', usBoxY + boxHeight / 2).attr('y2', usBoxY + boxHeight / 2).attr('stroke', usColor).attr('stroke-width', 1);
g.append('line').attr('x1', xScale(usStats.min)).attr('x2', xScale(usStats.min)).attr('y1', usBoxY).attr('y2', usBoxY + boxHeight).attr('stroke', usColor).attr('stroke-width', 1);
g.append('line').attr('x1', xScale(usStats.max)).attr('x2', xScale(usStats.max)).attr('y1', usBoxY).attr('y2', usBoxY + boxHeight).attr('stroke', usColor).attr('stroke-width', 1);
g.append('rect').attr('x', xScale(usStats.q1)).attr('y', usBoxY).attr('width', xScale(usStats.q3) - xScale(usStats.q1)).attr('height', boxHeight).attr('fill', usColor).attr('fill-opacity', 0.2).attr('stroke', usColor).attr('stroke-width', 1).attr('filter', 'url(#wobble)');
g.append('line').attr('x1', xScale(usStats.median)).attr('x2', xScale(usStats.median)).attr('y1', usBoxY).attr('y2', usBoxY + boxHeight).attr('stroke', usColor).attr('stroke-width', 2);

let rabelaisMedian = null;
if (underworldLaborers.length > 0) {
const rabelaisWages = underworldLaborers.map(d => d.wage).sort((a, b) => a - b);
rabelaisMedian = d3.quantile(rabelaisWages, 0.50);
g.append('line').attr('x1', xScale(rabelaisMedian)).attr('x2', xScale(rabelaisMedian)).attr('y1', 0).attr('y2', plotHeight).attr('stroke', '#c84034').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').attr('opacity', 0.9);
}

g.append('line').attr('x1', xScale(usStats.median)).attr('x2', xScale(usStats.median)).attr('y1', 0).attr('y2', plotHeight).attr('stroke', '#4a2c2a').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,4').attr('opacity', 0.7);
const dotRadius = 4.5;
const simulation = d3.forceSimulation(underworldLaborers)
.force("x", d3.forceX(d => xScale(d.wage)).strength(1))
.force("y", d3.forceY(stripTop + stripHeight / 2).strength(0.1))
.force("collide", d3.forceCollide(dotRadius + 1))
.stop();

for (let i = 0; i < 120; ++i) simulation.tick();

g.selectAll('.laborer-dot').data(underworldLaborers).enter().append('circle')
.attr('class', 'laborer-dot')
.attr('cx', d => d.x)
.attr('cy', d => d.y)
.attr('r', dotRadius)
.attr('fill', '#c84034')
.attr('opacity', 0.7)
.attr('stroke', '#4a2c2a')
.attr('stroke-width', 1)
.on('mouseover', function (event, d) {
d3.select(this).attr('opacity', 1).attr('r', dotRadius + 2);
// --- MODIFICATION: Use style('display', 'block') ---
// --- MODIFICATION: Updated tooltip text with bold headers and new header class ---
tooltip.style('display', 'block').html(`<div class="tooltip-header">${d.name}</div><strong>Underworld Labor:</strong> ${d.labor || 'Unknown'}<br/><strong>Modern Equivalent:</strong> ${d.occTitle || 'N/A'}<br/><strong>Annual Wage:</strong> $${d.wage.toLocaleString()}`);
})
.on('mousemove', (event) => tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px'))
.on('mouseout', function () {
d3.select(this).attr('opacity', 0.7).attr('r', dotRadius);
// --- MODIFICATION: Use style('display', 'none') ---
tooltip.style('display', 'none');
});
const legend = g.append('g').attr('class', 'legend').attr('transform', `translate(${plotWidth - 220}, 10)`);
legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 210).attr('height', 55).attr('fill', '#d4c4a0').attr('stroke', '#4a2c2a').attr('stroke-width', 1).style('opacity', 0.8);
legend.append('line').attr('x1', 10).attr('x2', 40).attr('y1', 15).attr('y2', 15).attr('stroke', '#4a2c2a').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,4');
legend.append('text').attr('x', 45).attr('y', 15).attr('dominant-baseline', 'middle')
.style('font-size', '12px').style('fill', '#4a2c2a').style('font-family', "'IM Fell DW Pica', serif")
.text(`US Median: $${(usStats.median / 1000).toFixed(0)}K`);

if (rabelaisMedian) {
legend.append('line').attr('x1', 10).attr('x2', 40).attr('y1', 40).attr('y2', 40).attr('stroke', '#c84034').attr('stroke-width', 2).attr('stroke-dasharray', '5,5');
legend.append('text').attr('x', 45).attr('y', 40).attr('dominant-baseline', 'middle')
.style('font-size', '12px').style('fill', '#4a2c2a').style('font-family', "'IM Fell DW Pica', serif")
.text(`Underworld Median: $${(rabelaisMedian / 1000).toFixed(0)}K`);
}

// --- MODIFICATION: Add legend for strip plot ---
const stripLegend = g.append('g')
    .attr('class', 'legend-strip')
    .attr('transform', `translate(${plotWidth - 140}, ${plotHeight - 30})`); // Positioned bottom-right

// --- MODIFICATION: Add backdrop rect ---
stripLegend.append('rect')
    .attr('x', 0)
    .attr('y', -12) // Center rect vertically
    .attr('width', 130) // Set width
    .attr('height', 24) // Set height
    .attr('fill', '#d4c4a0')
    .attr('stroke', '#4a2c2a')
    .attr('stroke-width', 1)
    .style('opacity', 0.8);

stripLegend.append('circle')
    .attr('cx', 12) // Dot position (12px padding)
    .attr('cy', 0)  // Vertically centered
    .attr('r', dotRadius)
    .attr('fill', '#c84034')
    .attr('opacity', 0.7)
    .attr('stroke', '#4a2c2a')
    .attr('stroke-width', 1);

stripLegend.append('text')
    .attr('x', 25) // Text position (dot + 8px gap)
    .attr('y', 0)  // Vertically centered
    .attr('dominant-baseline', 'middle')
    .style('font-size', '12px')
    .style('fill', '#4a2c2a')
    .style('font-family', "'IM Fell DW Pica', serif")
    .text('= Solitary Soul');

const xAxis = d3.axisBottom(xScale).tickValues([20000, 30000, 50000, 75000, 100000, 150000, 250000, 400000]).tickFormat(d => '$' + (d / 1000).toFixed(0) + 'k');
g.append('g').attr('class', 'axis').attr('transform', `translate(0,${plotHeight})`).call(xAxis).attr('filter', 'url(#wobble)');
const yAxis = d3.axisLeft(yScaleHist).ticks(5).tickFormat(d => d === 0 ? "0" : d3.format(".1s")(d).replace('G', 'B').replace('M', 'M'));
g.append('g').attr('class', 'axis').call(yAxis).attr('filter', 'url(#wobble)');

svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').attr('x', width / 2).attr('y', height - 5).text('Annual Wage (log scale)');
svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').attr('transform', 'rotate(-90)').attr('x', -height / 2.5).attr('y', 20).text('Total Employment');
}

// Helper function to wrap text (RE-ADDED)
function wrapText(text, maxCharsPerLine = 26) {
// Split at natural break points
const words = text.split(/\s+/);
const lines = [];
let currentLine = '';
for (let word of words) {
const testLine = currentLine ? currentLine + ' ' + word : word;
// Check if adding this word exceeds the limit
// --- MODIFICATION: Fixed typo 'maxCharsPerLne' to 'maxCharsPerLine' ---
if (testLine.length > maxCharsPerLine && currentLine.length > 0) {
lines.push(currentLine);
currentLine = word;
} else {
currentLine = testLine;
}
}
if (currentLine) {
lines.push(currentLine);
}
return lines;
}

// createMajorGroupsComparison function (RE-ADDED)
function createMajorGroupsComparison(majorGroupData, rabelaisCharacters) {
const container = d3.select('#major-groups-viz');
const containerNode = container.node();
if (!containerNode) return;
const fullWidth = containerNode.clientWidth; // <-- Get full parent width for axis
const margin = { top: 20, right: 60, bottom: 20, left: 180 };
// --- MODIFICATION: axisHeight increased to 40 ---
const axisHeight = 40; // Height for the fixed axis below
// Count Rabelais characters by major group
const underworldCounts = {};
let totalUnderworld = 0;
rabelaisCharacters.forEach(char => {
if (char.major_group_title && char.major_group_title.trim()) {
const group = char.major_group_title;
underworldCounts[group] = (underworldCounts[group] || 0) + 1;
totalUnderworld++;
}
});
// Calculate percentages for US workforce
let totalUSEmployment = 0;
majorGroupData.forEach(d => {
totalUSEmployment += parseFloat(d.TOT_EMP);
});
// Prepare data for visualization
const comparisonData = [];
majorGroupData.forEach(d => {
const groupTitle = d.major_group_title;
const usEmployment = parseFloat(d.TOT_EMP);
const usPercentage = (usEmployment / totalUSEmployment) * 100;
const underworldCount = underworldCounts[groupTitle] || 0;
const underworldPercentage = totalUnderworld > 0 ? (underworldCount / totalUnderworld) * 100 : 0;
comparisonData.push({
group: groupTitle,
usPercentage: usPercentage,
underworldPercentage: underworldPercentage,
underworldCount: underworldCount,
usEmployment: usEmployment
});
});
// Sort by underworld percentage (descending)
comparisonData.sort((a, b) => b.underworldPercentage - a.underworldPercentage);
// Set up dimensions
// --- MODIFICATION: barHeight changed from 30 to 25 ---
const barHeight = 25;
const groupSpacing = 15;
const height = comparisonData.length * (barHeight * 2 + groupSpacing) + margin.top + margin.bottom;
container.selectAll('*').remove();

// Create scrollable container for bars
const scrollContainer = container.append('div')
.attr('class', 'chart-scroll-container')
// --- MODIFICATION: height changed from 400px to 300px ---
.style('height', '300px');

const scrollContainerNode = scrollContainer.node();
if (!scrollContainerNode) return;
const scrollableWidth = scrollContainerNode.clientWidth;
const plotWidth = scrollableWidth - margin.left - margin.right;

const svg = scrollContainer.append('svg')
.attr('width', scrollableWidth)
.attr('height', height);
// Reuse filters from the main visualization
const defs = svg.append('defs');
const filter = defs.append('filter').attr('id', 'wobble-groups');
filter.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.03').attr('numOctaves', '1').attr('result', 'turbulence');
filter.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'turbulence').attr('scale', '2');
const textureFilter = defs.append('filter').attr('id', 'parchment-texture-groups')
.attr('x','0%').attr('y','0%').attr('width','100%').attr('height','100%');
textureFilter.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.02 0.05').attr('numOctaves', '2').attr('result', 'noise');
textureFilter.append('feColorMatrix').attr('type', 'matrix').attr('values', `0 0 0 0 0.827 0 0 0 0 0.768 0 0 0 0 0.627 0 0 0 0.3 0`);
const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
// Background
g.append('rect').attr('x', -margin.left).attr('y', -margin.top).attr('width', scrollableWidth).attr('height', height).attr('fill', '#f0e8d8');
g.append('rect').attr('x', -margin.left).attr('y', -margin.top).attr('width', scrollableWidth).attr('height', height).style('filter', 'url(#parchment-texture-groups)');
// Scales
const maxPercentage = Math.max(
d3.max(comparisonData, d => d.usPercentage),
d3.max(comparisonData, d => d.underworldPercentage)
);
const xScale = d3.scaleLinear().domain([0, maxPercentage]).range([0, plotWidth]).nice();

// Draw bars for each group
comparisonData.forEach((d, i) => {
const yPos = i * (barHeight * 2 + groupSpacing);
// Group label with text wrapping
const wrappedLines = wrapText(d.group, 26);
const textElement = g.append('text')
.attr('x', -10)
.attr('y', yPos + barHeight)
.attr('text-anchor', 'end')
.style('font-size', '13px')
.style('fill', '#4a2c2a')
.style('font-family', "'IM Fell DW Pica', serif");
// Add each line as a tspan
wrappedLines.forEach((line, lineIndex) => {
const lineHeight = 14;
const totalHeight = wrappedLines.length * lineHeight;
const startY = -(totalHeight / 2) + (lineHeight / 2);
textElement.append('tspan')
.attr('x', -10)
.attr('dy', lineIndex === 0 ? startY : lineHeight)
.text(line);
});

// --- MODIFICATION: Removed the first (hidden) divider line ---

// Underworld bar (red)
g.append('rect')
.attr('x', 0)
.attr('y', yPos)
.attr('width', xScale(d.underworldPercentage))
.attr('height', barHeight)
.attr('fill', '#c84034')
.attr('fill-opacity', 0.7)
.attr('stroke', '#4a2c2a')
.attr('stroke-width', 1)
.attr('filter', 'url(#wobble-groups)');

// US workforce bar (blue)
g.append('rect')
.attr('x', 0)
.attr('y', yPos + barHeight)
.attr('width', xScale(d.usPercentage))
.attr('height', barHeight)
.attr('fill', '#4a7ba7')
.attr('fill-opacity', 0.7)
.attr('stroke', '#4a2c2a')
.attr('stroke-width', 1)
.attr('filter', 'url(#wobble-groups)');

// Value labels
if (d.underworldPercentage > 3) {
g.append('text')
.attr('x', xScale(d.underworldPercentage) - 5)
.attr('y', yPos + barHeight / 2)
.attr('text-anchor', 'end')
.attr('dominant-baseline', 'middle')
.style('font-size', '11px')
.style('fill', '#ffffff')
.style('font-family', "'IM Fell DW Pica', serif")
.style('font-weight', '600')
.text(`${d.underworldPercentage.toFixed(1)}%`);
}
if (d.usPercentage > 3) {
g.append('text')
.attr('x', xScale(d.usPercentage) - 5)
.attr('y', yPos + barHeight + barHeight / 2)
.attr('text-anchor', 'end')
.attr('dominant-baseline', 'middle')
.style('font-size', '11px')
.style('fill', '#ffffff')
.style('font-family', "'IM Fell DW Pica', serif")
.style('font-weight', '600')
.text(`${d.usPercentage.toFixed(1)}%`);
}

// --- MODIFICATION: Moved vertical divider line here ---
// Draws the line *after* the bars, so it's visible on top
g.append('line')
    .attr('x1', -1) // --- FIX: Changed from 0 to -1 to be visible
    .attr('x2', -1) // --- FIX: Changed from 0 to -1 to be visible
    .attr('y1', yPos)
    .attr('y2', yPos + barHeight * 2)
    .attr('stroke', '#4a2c2a')
    .attr('stroke-width', 1)
    .attr('filter', 'url(#wobble-groups)');

});
// Create fixed axis container below the scrollable area
const axisContainer = container.append('svg')
.attr('width', fullWidth)
.attr('height', axisHeight)
.style('display', 'block');
const axisG = axisContainer.append('g')
// --- MODIFICATION: transform 'y' remains 0 ---
.attr('transform', `translate(${margin.left},0)`);
// X-axis in fixed container
const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d => d + '%');
axisG.append('g')
.attr('class', 'axis')
.call(xAxis)
// --- MODIFICATION: Added stroke-width to the axis line ---
.select('.domain').attr('stroke-width', 2); // Selects the horizontal line
axisG.select('.axis').attr('filter', 'url(#wobble-groups)'); // Apply filter to the whole axis group
// Axis label
axisContainer.append('text')
.attr('class', 'axis-label')
.attr('text-anchor', 'middle')
.attr('x', fullWidth / 2)
// --- MODIFICATION: 'y' position adjusted to bottom of container ---
.attr('y', axisHeight - 5) // Positioned at y=35, at the bottom of the 40px container
.text('Percentage of Workforce');

// MODIFICATION: Legend drawing code removed from here

}

function highlightNames(characters) {
const passage = document.getElementById('rabelais-passage');
const paragraphs = passage.getElementsByTagName('p');
characters.sort((a, b) => b.name.length - a.name.length);
Array.from(paragraphs).forEach(paragraph => {
if (paragraph.parentElement.classList.contains('passage-attribution')) return;
let html = paragraph.innerHTML;
const tooltipPlaceholders = [];
let placeholderIndex = 0;
characters.forEach(char => {
const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(`\\b(${escapedName})\\b`, 'gi');
html = html.replace(regex, (match) => {
const tooltipText = char.description || 'No description available';
const nameDisplay = char.name;
let hierarchyContent = '';
if (char.labor) { hierarchyContent += `<div class="labor-line"><strong>Underworld labor:</strong> <em>${char.labor}</em></div>`; }
if (char.major_group_title) { hierarchyContent += `<div class="hierarchy-level"><span class="hierarchy-branch">├── </span>I. ${char.major_group_title}</div>`; }
if (char.minor_group_title) { hierarchyContent += `<div class="hierarchy-level"><span class="hierarchy-branch">&nbsp;&nbsp;&nbsp;&nbsp;└── </span>II. ${char.minor_group_title}</div>`; }
if (char.broad_group_title) { hierarchyContent += `<div class="hierarchy-level"><span class="hierarchy-branch">&nbsp;&;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── </span>III. ${char.broad_group_title}</div>`; }
if (char.occ_title) { hierarchyContent += `<div class="hierarchy-level hierarchy-level-4"><span class="hierarchy-branch">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── </span>IV. ${char.occ_title}</div>`; }
const hierarchyBox = hierarchyContent ? `<div class="hierarchy-box">${hierarchyContent}</div>` : '';
const placeholder = `___TOOLTIP_${placeholderIndex}___`;
tooltipPlaceholders[placeholderIndex] = `<span class="tooltip-name">${nameDisplay}</span><span class="tooltip-description">${tooltipText}</span>${hierarchyBox}`;
placeholderIndex++;
return `<span class="annotated-name">${match}<span class="name-tooltip">${placeholder}</span></span>`;
});
});
tooltipPlaceholders.forEach((content, index) => { html = html.replace(`___TOOLTIP_${index}___`, content); });
paragraph.innerHTML = html;
});
}
</script>

<?php include '../../includes/footer.php'; ?>
