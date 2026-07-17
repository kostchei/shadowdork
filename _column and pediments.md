Here are the generators alternating between Python and JavaScript.  
To generate these as raw game assets, the scripts calculate the vertex arrays for the procedural elements (the fluted shafts and the pediment structure). The highly organic elements—like the Corinthian acanthus leaves or Ionic volute scrolls—are mathematically inefficient to generate at runtime and are typically handled via kitbashed meshes placed on top of these parametric shafts.

## **1\. Doric Column (Python)**

The Doric order is massive and heavy. Its height is typically 4 to 6 times its base diameter. It has 20 flutes with sharp edges (arrises), which we achieve by using an absolute sine wave without clamping.  
`import math`

`def generate_doric_shaft(scale=1.0, height_steps=20, radial_steps=60):`  
    `# Doric Proportions: Height ~ 5.5x base diameter`  
    `base_radius = 1.0 * scale`  
    `height = 11.0 * scale`  
    `flutes = 20`  
      
    `vertices = []`  
      
    `for z_step in range(height_steps + 1):`  
        `z = (z_step / height_steps) * height`  
          
        `# Entasis: Tapers mostly in the top 2/3rds`  
        `if z < height / 3:`  
            `taper = 0.0`  
        `else:`  
            `taper = 0.15 * ((z - height / 3) / (height * 0.66))**2`  
              
        `current_radius = base_radius * (1.0 - taper)`

        `for r_step in range(radial_steps):`  
            `theta = (r_step / radial_steps) * 2 * math.pi`  
              
            `# Sharp arrises using an absolute sine wave`  
            `# Raised to the power of 1.5 to smooth the valleys`  
            `flute_depth = 0.08 * scale * (abs(math.sin(flutes * theta / 2)) ** 1.5)`  
            `r = current_radius - flute_depth`  
              
            `x = r * math.cos(theta)`  
            `y = r * math.sin(theta)`  
            `vertices.append((x, y, z))`  
              
    `return vertices # Export to OBJ or mesh pipeline`

## **2\. Ionic Column (JavaScript)**

The Ionic order is taller and more slender, with a height 8 to 9 times its base diameter. Crucially, it has 24 flutes, and they are separated by flat ridges (fillets) rather than sharp edges. We achieve this mathematically by clamping the top of the sine wave.  
`function generateIonicShaft(scale = 1.0, heightSteps = 20, radialSteps = 72) {`  
    `const baseRadius = 1.0 * scale;`  
    `const height = 18.0 * scale; // Ionic Proportions: Height ~ 9x diameter`  
    `const flutes = 24;`  
      
    `const vertices = [];`  
      
    `for (let zStep = 0; zStep <= heightSteps; zStep++) {`  
        `const z = (zStep / heightSteps) * height;`  
          
        `// Entasis: Smoother, continuous curve from bottom to top`  
        `const taper = 0.1 * Math.pow(z / height, 2);`   
        `const currentRadius = baseRadius * (1.0 - taper);`  
          
        `for (let rStep = 0; rStep < radialSteps; rStep++) {`  
            `const theta = (rStep / radialSteps) * 2 * Math.PI;`  
              
            `// Filleted arrises: Clamp the peak of the wave to create a flat ridge`  
            `const wave = Math.sin(flutes * theta / 2);`  
            `const isRidge = wave > 0.8;`  
            `const fluteDepth = 0.06 * scale * (isRidge ? 0 : Math.pow(Math.abs(wave), 2));`  
              
            `const r = currentRadius - fluteDepth;`  
              
            `// Format for standard Y-up game engines (like Three.js or Unity)`  
            `vertices.push(`  
                `r * Math.cos(theta),`   
                `z,`   
                `r * Math.sin(theta)`  
            `);`  
        `}`  
    `}`  
    `return vertices; // Load into Float32Array for WebGL/Three.js`  
`}`

## **3\. Corinthian Column (Python)**

The Corinthian shaft is the most slender, reaching up to 10 times the base diameter. It shares the 24 filleted flutes of the Ionic order, but its entasis is much less pronounced, forming a nearly straight vertical line.  
`import math`

`def generate_corinthian_shaft(scale=1.0, height_steps=20, radial_steps=72):`  
    `# Corinthian Proportions: Height ~ 10x base diameter`  
    `base_radius = 1.0 * scale`  
    `height = 20.0 * scale`  
    `flutes = 24`  
      
    `vertices = []`  
      
    `for z_step in range(height_steps + 1):`  
        `z = (z_step / height_steps) * height`  
          
        `# Entasis: Very subtle quadratic taper`  
        `taper = 0.05 * (z / height)**2`  
        `current_radius = base_radius * (1.0 - taper)`

        `for r_step in range(radial_steps):`  
            `theta = (r_step / radial_steps) * 2 * math.pi`  
              
            `# Filleted arrises (flat ridges between flutes)`  
            `wave = math.sin(flutes * theta / 2)`  
            `if wave > 0.85:`  
                `flute_depth = 0.0`  
            `else:`  
                `flute_depth = 0.05 * scale * (wave ** 2)`  
                  
            `r = current_radius - flute_depth`  
              
            `x = r * math.cos(theta)`  
            `y = r * math.sin(theta)`  
            `vertices.append((x, y, z))`  
              
    `return vertices`

## **4\. Temple Pediment (JavaScript)**

The pediment geometry is driven by the total span width and the pitch angle of the roof. Classical roofs have low pitches—usually between 12 and 16 degrees.  
`function generatePediment(scale = 1.0, spanWidth = 20.0, pitchDegrees = 14) {`  
    `const w = spanWidth * scale;`  
    `const pitchRad = pitchDegrees * (Math.PI / 180);`  
      
    `// Calculate peak height using basic trigonometry`  
    `const peakHeight = (w / 2) * Math.tan(pitchRad);`  
      
    `// The depth of the cornice overhanging the columns`  
    `const depth = 2.0 * scale;`   
      
    `// Defining the 6 core vertices of the triangular wedge (Tympanum)`  
    `const vertices = [`  
        `// --- Front Face ---`  
        `-w/2, 0, 0,           // Bottom Left`  
         `w/2, 0, 0,           // Bottom Right`  
         `0, peakHeight, 0,    // Peak`  
           
        `// --- Back Face (Extrusion) ---`  
        `-w/2, 0, -depth,      // Back Bottom Left`  
         `w/2, 0, -depth,      // Back Bottom Right`  
         `0, peakHeight, -depth // Back Peak`  
    `];`  
      
    `// Procedural generation usually returns faces as vertex indices`  
    `const indices = [`  
        `0, 1, 2, // Front triangle`  
        `5, 4, 3, // Back triangle`  
        `0, 3, 4, // Bottom face triangle 1`  
        `0, 4, 1, // Bottom face triangle 2`  
        `1, 4, 5, // Right roof slope triangle 1`  
        `1, 5, 2, // Right roof slope triangle 2`  
        `2, 5, 3, // Left roof slope triangle 1`  
        `2, 3, 0  // Left roof slope triangle 2`  
    `];`  
      
    `return { vertices, indices };`  
`}`  
