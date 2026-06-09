// ghost-animation.js
// Ghost animation module for underworld figures visualization

(function (global) {
  "use strict";

  // Module-scoped state
  let ghostTimer = null;
  let ghostGroup = null;

  /**
   * Initialize the ghost SVG symbol in the provided defs element
   * @param {d3.selection} defs - D3 selection of SVG defs element
   */
  function initializeGhostSymbol(defs) {
    const ghostSymbol = defs
      .append("symbol")
      .attr("id", "spectre-creux")
      .attr("viewBox", "0 0 24 24");

    ghostSymbol
      .append("path")
      .attr(
        "d",
        "M12,1 C8,1 5,4 5,8 C5,12 5,16 6,20 C7,22 8,22 9,20 C10,18 11,18 12,20 C13,22 14,22 15,20 C16,18 17,18 18,20 C19,22 20,22 19,18 C19,14 19,10 19,8 C19,4 16,1 12,1 Z",
      )
      .attr("fill", "#f0e8d8")
      .attr("stroke", "#3d2b18")
      .attr("stroke-width", "0.8");

    ghostSymbol
      .append("ellipse")
      .attr("cx", 9)
      .attr("cy", 9)
      .attr("rx", 2)
      .attr("ry", 2.5)
      .attr("fill", "#3d2b18");

    ghostSymbol
      .append("ellipse")
      .attr("cx", 15)
      .attr("cy", 9)
      .attr("rx", 2)
      .attr("ry", 2.5)
      .attr("fill", "#3d2b18");
  }

  /**
   * Render wandering ghost figures for an occupation
   * @param {string} occCode - Occupation code
   * @param {HTMLElement} container - Container element
   * @param {Object} dependencies - Required dependencies from main app
   */
  function renderUnderworldFigures(occCode, container, dependencies) {
    const { g, createUnderworldTooltipHTML } = dependencies;

    // Cleanup any existing animation
    cleanup();

    const characters = g.charactersData.filter((c) => c.occ_code === occCode);
    const headerText = "Souls Assigned to This Fate";

    if (!characters || characters.length === 0) {
      // Render no-data state as SVG elements (same approach as with-ghosts)
      // so positioning is pixel-perfect regardless of viewBox scaling.
      container.innerHTML = "";

      setTimeout(() => {
        const fullContainer = container.parentElement;
        const fullContainerRect = fullContainer.getBoundingClientRect();
        const svgEl = g.svg.node();
        const svgRect = svgEl.getBoundingClientRect();
        const scaleX = g.svgWidth / svgRect.width;
        const scaleY = g.svgHeight / svgRect.height;
        const fullOffsetX = (fullContainerRect.left - svgRect.left) * scaleX;
        const fullOffsetY = (fullContainerRect.top - svgRect.top) * scaleY;
        const fullWidth = fullContainerRect.width * scaleX;
        const fullHeight = fullContainerRect.height * scaleY;

        ghostGroup = g.svg.append("g").attr("class", "wandering-ghosts");

        // Background — Nuremberg parchment with frame
        ghostGroup
          .append("rect")
          .attr("x", fullOffsetX)
          .attr("y", fullOffsetY)
          .attr("width", fullWidth)
          .attr("height", fullHeight)
          .attr("fill", "#cfc2a0")
          .attr("stroke", "rgba(26, 20, 8, 0.5)")
          .attr("stroke-width", 1.5)
          .style("pointer-events", "none");
        // Inner rule
        ghostGroup
          .append("rect")
          .attr("x", fullOffsetX + 3)
          .attr("y", fullOffsetY + 3)
          .attr("width", fullWidth - 6)
          .attr("height", fullHeight - 6)
          .attr("fill", "none")
          .attr("stroke", "rgba(61, 43, 24, 0.35)")
          .attr("stroke-width", 0.75)
          .style("pointer-events", "none");

        // Header — rubricated small caps
        ghostGroup
          .append("text")
          .attr("x", fullOffsetX + 12)
          .attr("y", fullOffsetY + 27)
          .attr("font-family", "'Cormorant Garamond', Georgia, serif")
          .attr("font-size", "12px")
          .attr("font-weight", "700")
          .attr("fill", "#b33a2b")
          .attr("stroke", "#b33a2b")
          .attr("stroke-width", "0.4")
          .attr("paint-order", "stroke fill")
          .style("text-transform", "uppercase")
          .style("letter-spacing", "0.04em")
          .style("pointer-events", "none")
          .text(headerText);

        // Divider — Vermillion accent
        ghostGroup
          .append("line")
          .attr("x1", fullOffsetX + 10)
          .attr("y1", fullOffsetY + 39)
          .attr("x2", fullOffsetX + fullWidth - 10)
          .attr("y2", fullOffsetY + 39)
          .attr("stroke", "rgba(179, 58, 43, 0.2)")
          .attr("stroke-width", 1.5)
          .style("pointer-events", "none");

        // No-data message as foreignObject for proper text wrapping
        var noDataFO = ghostGroup
          .append("foreignObject")
          .attr("x", fullOffsetX)
          .attr("y", fullOffsetY + 47)
          .attr("width", fullWidth)
          .attr("height", fullHeight - 47);

        noDataFO.html(
          '<div xmlns="http://www.w3.org/1999/xhtml" style="padding: 0 12px; box-sizing: border-box;">' +
            "<p style=\"font-family: 'Cormorant Garamond', Georgia, serif; font-size: 14px; color: #2c2014; font-style: italic; line-height: 1.5; margin: 0;\">" +
            "Epistemon does not mention seeing any figures condemned to this occupation during his tour of the underworld." +
            "</p>" +
            '<img src="../assets/rabelais-clips/demons-with-decapitated-body.svg" alt="" style="display:block; margin:12px auto 0; max-width:150px; opacity:0.75;" />' +
            "</div>",
        );
      }, 100);
      return;
    }

    container.innerHTML =
      '<div id="ghost-placeholder" class="ghost-placeholder"></div>';

    setTimeout(() => {
      const placeholder = document.getElementById("ghost-placeholder");
      if (!placeholder) return;

      const fullContainer = container.parentElement;
      const fullContainerRect = fullContainer.getBoundingClientRect();
      const svgEl = g.svg.node();
      const svgRect = svgEl.getBoundingClientRect();
      const scaleX = g.svgWidth / svgRect.width;
      const scaleY = g.svgHeight / svgRect.height;
      const fullOffsetX = (fullContainerRect.left - svgRect.left) * scaleX;
      const fullOffsetY = (fullContainerRect.top - svgRect.top) * scaleY;
      const fullWidth = fullContainerRect.width * scaleX;
      const fullHeight = fullContainerRect.height * scaleY;
      // Ghost area: full container minus header (aligned with Work Context title)
      const headerReserve = 47;
      const ghostAreaX = fullOffsetX;
      const ghostAreaY = fullOffsetY + headerReserve;
      const ghostAreaWidth = fullWidth;
      const ghostAreaHeight = Math.max(0, fullHeight - headerReserve);
      const clipId = "ghost-clip-" + Date.now();

      g.svg
        .select("defs")
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", ghostAreaX)
        .attr("y", ghostAreaY)
        .attr("width", ghostAreaWidth)
        .attr("height", ghostAreaHeight);

      ghostGroup = g.svg.append("g").attr("class", "wandering-ghosts");

      // Background — Nuremberg parchment with frame
      ghostGroup
        .append("rect")
        .attr("x", fullOffsetX)
        .attr("y", fullOffsetY)
        .attr("width", fullWidth)
        .attr("height", fullHeight)
        .attr("fill", "#cfc2a0")
        .attr("stroke", "rgba(26, 20, 8, 0.5)")
        .attr("stroke-width", 1.5)
        .style("pointer-events", "none");
      // Inner rule
      ghostGroup
        .append("rect")
        .attr("x", fullOffsetX + 3)
        .attr("y", fullOffsetY + 3)
        .attr("width", fullWidth - 6)
        .attr("height", fullHeight - 6)
        .attr("fill", "none")
        .attr("stroke", "rgba(61, 43, 24, 0.35)")
        .attr("stroke-width", 0.75)
        .style("pointer-events", "none");

      // Header — rubricated small caps
      ghostGroup
        .append("text")
        .attr("x", fullOffsetX + 12)
        .attr("y", fullOffsetY + 27)
        .attr("font-family", "'Cormorant Garamond', Georgia, serif")
        .attr("font-size", "12px")
        .attr("font-weight", "700")
        .attr("fill", "#b33a2b")
        .attr("stroke", "#b33a2b")
        .attr("stroke-width", "0.4")
        .attr("paint-order", "stroke fill")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "0.04em")
        .style("pointer-events", "none")
        .text(headerText);

      // Divider — Vermillion accent
      ghostGroup
        .append("line")
        .attr("x1", fullOffsetX + 10)
        .attr("y1", fullOffsetY + 39)
        .attr("x2", fullOffsetX + fullWidth - 10)
        .attr("y2", fullOffsetY + 39)
        .attr("stroke", "rgba(179, 58, 43, 0.2)")
        .attr("stroke-width", 1.5)
        .style("pointer-events", "none");

      // Bottom flame ornament
      const flameH = 240 * (1392 / 2302) * 0.95; // slightly reduced height
      const flameW = 260;
      const flameSrc = "../assets/rabelais-clips/flames-edited-2.svg";
      ghostGroup
        .append("image")
        .attr("href", flameSrc)
        .attr("width", flameW)
        .attr("height", flameH)
        .attr("preserveAspectRatio", "none")
        .attr("x", fullOffsetX + (fullWidth - flameW) / 2)
        .attr("y", fullOffsetY + fullHeight - flameH - 5)
        .attr("opacity", 0.45)
        .style("pointer-events", "none");

      const ghostsClipped = ghostGroup
        .append("g")
        .attr("clip-path", "url(#" + clipId + ")");

      const ghostSize = 32;
      const padding = 8;
      const ghostSpacing = 24;
      const cols = Math.max(
        1,
        Math.floor((ghostAreaWidth - padding * 2) / (ghostSize + ghostSpacing)),
      );
      const bounds = {
        minX: ghostAreaX + padding,
        minY: ghostAreaY + padding,
        maxX: ghostAreaX + ghostAreaWidth - ghostSize - padding,
        maxY: ghostAreaY + ghostAreaHeight - ghostSize - padding - 24,
      };

      const ghostStates = characters.map((char, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const startX = ghostAreaX + padding + col * (ghostSize + ghostSpacing);
        const startY = ghostAreaY + padding + row * (ghostSize + 34);
        const startsMoving = Math.random() > 0.7;
        let targetX = startX,
          targetY = startY;
        if (startsMoving) {
          targetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
          targetY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        }
        return {
          char: char,
          x: startX,
          y: startY,
          targetX: targetX,
          targetY: targetY,
          moving: startsMoving,
          frozen: false,
          pauseTimer: startsMoving ? 0 : 30 + Math.random() * 300,
          phase: Math.random() * Math.PI * 2,
          baseSpeedMultiplier: 0.6 + Math.random() * 0.8,
          journeySpeed: 0.15 + Math.random() * 0.25,
          vx: 0,
          vy: 0,
          journeyStartDist: startsMoving
            ? Math.sqrt(
                Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2),
              )
            : 0,
        };
      });

      const ghosts = ghostsClipped
        .selectAll("g.wandering-ghost")
        .data(ghostStates)
        .enter()
        .append("g")
        .attr("class", "wandering-ghost")
        .attr("transform", (d) => "translate(" + d.x + ", " + d.y + ")")
        .style("cursor", "pointer")
        .style("pointer-events", "all")
        .style("opacity", 0.9);

      ghosts
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", ghostSize)
        .attr("height", ghostSize + 24)
        .attr("fill", "transparent")
        .style("pointer-events", "all");

      ghosts
        .append("use")
        .attr("href", "#spectre-creux")
        .attr("width", ghostSize)
        .attr("height", ghostSize)
        .style("pointer-events", "none");

      ghosts.each(function (d) {
        const gEl = d3.select(this);
        const name = d.char.name;
        const words = name.split(/\s+/);
        let lines = [];
        let currentLine = "";
        words.forEach((word) => {
          const testLine = currentLine ? currentLine + " " + word : word;
          if (testLine.length > 12 && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else currentLine = testLine;
        });
        if (currentLine) lines.push(currentLine);
        lines.forEach((line, i) => {
          gEl
            .append("text")
            .attr("x", ghostSize / 2)
            .attr("y", ghostSize + 10 + i * 11)
            .attr("text-anchor", "middle")
            .attr("font-family", "'Cormorant Garamond', Georgia, serif")
            .attr("font-size", "10px")
            .attr("fill", "#3d2b18")
            .style("pointer-events", "none")
            .text(line);
        });
      });

      ghosts
        .on("mouseover", (event, d) => {
          d.frozen = true;
          g.tooltip
            .attr("class", "tooltip character-tooltip")
            .style("display", "block")
            .html(createUnderworldTooltipHTML(d.char))
            .style("top", event.pageY + 10 + "px")
            .style("left", event.pageX + 10 + "px");
        })
        .on("mousemove", (event) => {
          g.tooltip
            .style("top", event.pageY + 10 + "px")
            .style("left", event.pageX + 10 + "px");
        })
        .on("mouseout", (event, d) => {
          d.frozen = false;
          g.tooltip.style("display", "none");
        });

      const animDelay = 3000;
      const bobAmplitude = 2;
      const bobSpeed = 0.002;
      const acceleration = 0.08;

      ghostTimer = d3.timer((elapsed) => {
        if (elapsed < animDelay) return;
        ghostStates.forEach((state) => {
          if (state.frozen) return;
          state.phase += bobSpeed * 16;
          if (state.moving) {
            const dx = state.targetX - state.x;
            const dy = state.targetY - state.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) {
              state.x = state.targetX;
              state.y = state.targetY;
              state.vx = 0;
              state.vy = 0;
              state.moving = false;
              state.pauseTimer = 180 + Math.random() * 720;
            } else {
              const maxSpeed = state.journeySpeed * state.baseSpeedMultiplier;
              const distTraveled = state.journeyStartDist - dist;
              const easeInDist = state.journeyStartDist * 0.2;
              const easeOutDist = 30;
              let targetSpeed = maxSpeed;
              if (distTraveled < easeInDist && easeInDist > 0)
                targetSpeed =
                  maxSpeed * (0.1 + 0.9 * (distTraveled / easeInDist));
              if (dist < easeOutDist)
                targetSpeed = Math.min(
                  targetSpeed,
                  maxSpeed * (0.1 + 0.9 * (dist / easeOutDist)),
                );
              const dirX = dx / dist;
              const dirY = dy / dist;
              const targetVx = dirX * targetSpeed;
              const targetVy = dirY * targetSpeed;
              state.vx += (targetVx - state.vx) * acceleration;
              state.vy += (targetVy - state.vy) * acceleration;
              state.x += state.vx;
              state.y += state.vy;
            }
          } else {
            state.pauseTimer--;
            if (state.pauseTimer <= 0) {
              state.targetX =
                bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
              state.targetY =
                bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
              state.journeySpeed = 0.15 + Math.random() * 0.25;
              state.journeyStartDist = Math.sqrt(
                Math.pow(state.targetX - state.x, 2) +
                  Math.pow(state.targetY - state.y, 2),
              );
              state.moving = true;
            }
          }
        });
        ghosts.attr("transform", (d, i) => {
          const state = ghostStates[i];
          const bobOffset = Math.sin(state.phase) * bobAmplitude;
          return "translate(" + state.x + ", " + (state.y + bobOffset) + ")";
        });
      });
    }, 100);
  }

  /**
   * Cleanup ghost animation and SVG elements
   */
  function cleanup() {
    if (ghostTimer) {
      ghostTimer.stop();
      ghostTimer = null;
    }
    if (ghostGroup) {
      ghostGroup.remove();
      ghostGroup = null;
    }
  }

  // Export to global namespace
  global.GhostAnimation = {
    initialize: initializeGhostSymbol,
    render: renderUnderworldFigures,
    cleanup: cleanup,
  };
})(window);
