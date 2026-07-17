ChatGPT Plus


















Worked for 2m 2s

https://static.sciencelearn.org.nz/images/images/000/002/728/full/AFR_SCI_ART_04_CarbonateChemistry_StalagmitesStalactites.jpg?1522310573=
You mean stalactites, stalagmites, and flowstone. Yes: their shapes can be generated mathematically from a combination of thin-film fluid dynamics, reactive transport, surface growth, and instability theory.

The important correction is that this is not primarily ordinary sediment settling. Calcite is usually precipitated chemically from a flowing solution as dissolved carbon dioxide escapes and the water becomes supersaturated with calcium carbonate. The growing rock surface is therefore a moving-boundary problem: the water flow depends on the current shape, while deposition changes that shape. 

1. The common mathematical model
Represent the speleothem surface by points 
X
(
s
,
t
)
X(s,t). At every point, calculate:

the thickness 
h
h of the water film;

its surface velocity or flux 
q
q;

dissolved calcium concentration 
c
c;

precipitation rate 
R
R;

outward surface normal 
n
n.

Then move the rock surface:

∂
X
∂
t
=
V
n
n
,
V
n
=
Ω
R
∂t
∂X
​
 =V 
n
​
 n,V 
n
​
 =ΩR
where 
Ω
Ω converts precipitated calcium carbonate into solid volume.

The system can be separated into three equations.

Water flow
For a slow, thin film running down a surface, lubrication theory gives approximately

q
=
ρ
g
3
μ
h
3
sin
⁡
α
q= 
3μ
ρg
​
 h 
3
 sinα
where:

ρ
ρ is water density;

μ
μ is viscosity;

α
α is the local surface slope;

q
q is flow per unit width.

Thus,

h
∝
(
q
sin
⁡
α
)
1
/
3
.
h∝( 
sinα
q
​
 ) 
1/3
 .
That cube-root relationship is extremely important. Small changes in radius, slope, or flow concentration alter the film thickness, which changes deposition and therefore feeds back into the shape.

Dissolved mineral transport
A simplified reactive-transport equation is

∂
(
h
c
)
∂
t
+
∇
s
⋅
(
q
c
)
=
∇
s
⋅
(
h
D
∇
s
c
)
−
R
,
∂t
∂(hc)
​
 +∇ 
s
​
 ⋅(qc)=∇ 
s
​
 ⋅(hD∇ 
s
​
 c)−R,
where 
∇
s
∇ 
s
​
  means differentiation along the rock surface.

A practical precipitation law is

R
=
k
(
c
−
c
s
a
t
)
+
,
R=k(c−c 
sat
​
 ) 
+
​
 ,
where 
c
s
a
t
c 
sat
​
  is the saturation concentration and the 
+
+ means that negative values are set to zero.

Surface evolution
Finally,

X
t
+
Δ
t
=
X
t
+
Ω
R
n
 
Δ
t
.
X 
t+Δt
​
 =X 
t
​
 +ΩRnΔt.
Repeated many times, this produces the stone form.

2. Stalactites
For an axisymmetric stalactite, the total water flow 
Q
Q is distributed around a circumference 
2
π
r
2πr. Therefore,

Q
=
2
π
r
q
,
Q=2πrq,
and approximately

h
(
r
,
α
)
=
(
3
μ
Q
2
π
ρ
g
 
r
sin
⁡
α
)
1
/
3
.
h(r,α)=( 
2πρgrsinα
3μQ
​
 ) 
1/3
 .
The film becomes relatively thick where:

the radius 
r
r is small;

the surface is nearly horizontal;

water is concentrated into a narrow path.

If precipitation rate is roughly proportional to film thickness, then

V
n
∝
(
Q
r
sin
⁡
α
)
1
/
3
.
V 
n
​
 ∝( 
rsinα
Q
​
 ) 
1/3
 .
This is essentially the published geometric growth law for ideal stalactites. It predicts very rapid growth near the tip and slower widening farther up the body. Simulations starting with many different rounded shapes converge toward a similar “universal” stalactite profile. 

Far from the rounded tip, that ideal profile approximately obeys

z
∝
r
4
/
3
,
z∝r 
4/3
 ,
or equivalently

r
∝
z
3
/
4
.
r∝z 
3/4
 .
That is immediately useful for drawing.

Simple procedural stalactite
Measure 
y
y upward from the tip:

r
(
y
)
=
r
t
i
p
+
A
y
3
/
4
.
r(y)=r 
tip
​
 +Ay 
3/4
 .
Then perturb it:

r
(
y
,
ϕ
)
=
r
(
y
)
[
1
+
a
1
N
(
y
,
ϕ
)
+
a
2
sin
⁡
(
2
π
y
λ
+
ψ
)
]
.
r(y,ϕ)=r(y)[1+a 
1
​
 N(y,ϕ)+a 
2
​
 sin( 
λ
2πy
​
 +ψ)].
Here:

N
N is smooth 2D or 3D noise;

the sine term creates growth rings or crenulations;

λ
λ controls ripple spacing;

ϕ
ϕ is the angle around the stalactite.

The tip should be replaced by a rounded cap because the thin-film equation breaks down where a pendant droplet and surface tension dominate. The physical model itself predicts this limitation. 

A useful artistic interpretation is:

profile
=
universal 
y
3
/
4
 taper
+
low-frequency bend
+
small growth ripples
.
profile=universal y 
3/4
  taper+low-frequency bend+small growth ripples.
3. Stalagmites
A stalagmite has different physics. The incoming drop strikes the apex, spreads radially, and then drains down the sides. The impact and spreading make stalagmites generally blunter than stalactites; they are not simply upside-down copies. 

For radial flow,

q
(
r
)
=
Q
2
π
r
,
q(r)= 
2πr
Q
​
 ,
so the film again has approximately

h
(
r
)
∝
(
Q
r
sin
⁡
α
)
1
/
3
.
h(r)∝( 
rsinα
Q
​
 ) 
1/3
 .
But the dissolved mineral concentration decreases as the film travels outward:

d
c
d
r
≈
−
2
π
r
Q
 
k
(
c
−
c
s
a
t
)
 
G
(
α
)
,
dr
dc
​
 ≈− 
Q
2πr
​
 k(c−c 
sat
​
 )G(α),
where 
G
(
α
)
G(α) accounts for the relationship between surface distance and horizontal radius.

Thus:

deposition is strongest near the impact point;

residual mineral is carried outward;

the balance between reaction speed and transport distance determines width.

A 2025 analytical study derived ideal steadily growing stalagmite shapes and found that their principal shape variation can be represented by a single dimensionless reaction-versus-transport parameter, producing several natural shape families. 

Simple layer-deposition model
For drawing rather than geological simulation, treat each drop as adding a very thin radial layer:

Δ
z
(
r
)
=
A
exp
⁡
[
−
(
r
L
)
p
]
.
Δz(r)=Aexp[−( 
L
r
​
 ) 
p
 ].
Then repeatedly apply

z
n
+
1
(
r
)
=
z
n
(
r
)
+
Δ
z
(
r
)
z 
n+1
​
 (r)=z 
n
​
 (r)+Δz(r)
while calculating 
r
r along the current curved surface.

Parameters have intuitive effects:

small 
L
L: narrow, steep stalagmite;

large 
L
L: broad mound;

p
≈
1
p≈1: gently decaying, rounded form;

p
>
2
p>2: flatter summit and steeper shoulder;

fluctuating 
L
L: stacked bulges;

moving impact position: crooked or asymmetric growth.

A more believable kernel includes both a central impact area and an outward-flowing tail:

Δ
z
(
r
)
=
A
e
−
(
r
/
σ
)
2
+
B
e
−
r
/
L
.
Δz(r)=Ae 
−(r/σ) 
2
 
 +Be 
−r/L
 .
The Gaussian gives the splash/impact zone; the exponential gives continuing precipitation from the draining film.

Three-dimensional asymmetry
Let the drop impact wander:

x
i
m
p
a
c
t
(
t
+
Δ
t
)
=
x
i
m
p
a
c
t
(
t
)
+
η
(
t
)
,
x 
impact
​
 (t+Δt)=x 
impact
​
 (t)+η(t),
where 
η
η is small correlated noise.

Do not use independent random positions each frame. Use Brownian motion, Perlin noise, or an Ornstein–Uhlenbeck process, so the drip moves gradually. This naturally creates leaning, lobed stalagmites rather than white-noise roughness.

4. Flowstone
Flowstone is the most suitable for a heightfield or surface-fluid simulation. Water enters at cracks or drip points, flows across a wall or floor, loses dissolved carbonate, and raises the surface beneath it.

Let the rock surface be

z
=
z
(
x
,
y
,
t
)
.
z=z(x,y,t).
Project gravity onto the local surface:

g
t
=
g
−
(
g
⋅
n
)
n
.
g 
t
​
 =g−(g⋅n)n.
A thin-film flux can be approximated by

q
=
ρ
h
3
3
μ
(
g
t
−
1
ρ
∇
s
p
)
,
q= 
3μ
ρh 
3
 
​
 (g 
t
​
 − 
ρ
1
​
 ∇ 
s
​
 p),
with capillary pressure

p
=
−
γ
κ
,
p=−γκ,
where 
γ
γ is surface tension and 
κ
κ is surface curvature.

Water conservation is then

∂
h
∂
t
+
∇
s
⋅
q
=
S
−
D
,
∂t
∂h
​
 +∇ 
s
​
 ⋅q=S−D,
where 
S
S supplies water from cracks or drips and 
D
D represents drainage or removal.

Growth is again

∂
z
∂
t
=
Ω
k
(
c
−
c
s
a
t
)
+
.
∂t
∂z
​
 =Ωk(c−c 
sat
​
 ) 
+
​
 .
This coupling can generate:

smooth sheets where flow is evenly distributed;

ribs where flow converges;

draperies beneath inclined ceilings;

lobes where water repeatedly follows the same paths;

terraces and rims when flow and deposition become unstable.

Thin-film instability models have specifically been used to explain cave draperies and the rippled “crenulations” seen on speleothems. 

Cheap game version
You do not need to solve the full PDE. On a surface grid:

Add water at source cells.

Route each cell’s water to downhill neighbours.

Accumulate flux.

Carry a scalar called supersaturation.

Deposit some calcite based on residence time.

Reduce the transported supersaturation.

Raise the terrain.

Recalculate flow paths.

A usable rule is

D
i
=
k
 
h
i
a
 
σ
i
 
1
v
i
+
ϵ
,
D 
i
​
 =kh 
i
a
​
 σ 
i
​
  
v 
i
​
 +ϵ
1
​
 ,
where:

h
i
h 
i
​
  is water amount;

σ
i
σ 
i
​
  is remaining supersaturation;

v
i
v 
i
​
  is local flow speed;

slow water deposits more because it remains longer.

Then

z
i
←
z
i
+
D
i
Δ
t
,
z 
i
​
 ←z 
i
​
 +D 
i
​
 Δt,
σ
d
o
w
n
s
t
r
e
a
m
←
σ
i
−
β
D
i
.
σ 
downstream
​
 ←σ 
i
​
 −βD 
i
​
 .
Because deposition raises the surface, it redirects later water. That feedback creates believable channels, lobes, dams, and curtains.

5. Different formations emerge from boundary conditions
You could use almost the same mathematical engine for all three.

Formation	Water source	Initial surface	Dominant behaviour
Stalactite	ceiling seep or central tube	downward bump	film converges toward a dripping tip
Stalagmite	repeated falling drops	floor	radial impact and outward drainage
Flowstone	cracks, sheets, many drips	sloping wall or floor	distributed downhill film
Drapery	linear ceiling crack	inclined underside	narrow rivulet with sideways instability
Column	stalactite and stalagmite approach	both	eventual union of two moving boundaries
The stalactite and stalagmite should generally be simulated separately even when they share a drip source. Drop impact makes their growth laws different; only as the gap becomes very small does the lower formation tend to become more like a reflected stalactite. 

6. A sensible implementation hierarchy
For a renderer or game, I would use three levels.

Level 1: silhouettes
Use direct shape functions:

r
stalactite
(
y
)
=
A
(
y
+
y
0
)
3
/
4
,
r 
stalactite
​
 (y)=A(y+y 
0
​
 ) 
3/4
 ,
z
stalagmite
(
r
)
=
H
[
1
−
(
r
R
)
p
]
q
,
z 
stalagmite
​
 (r)=H[1−( 
R
r
​
 ) 
p
 ] 
q
 ,
plus smooth noise and layered colour bands.

Level 2: deposition layers
Represent the shape as a 2D cross-section or 3D heightfield. Each simulated year adds a thin calcite layer according to water flux and remaining supersaturation.

This gives visible growth rings and natural changes caused by altered drip rates.

Level 3: coupled surface simulation
Maintain:

(
h
,
q
,
c
,
z
)
(h,q,c,z)
and repeatedly solve flow, chemistry, and surface movement. Use this where the formation itself affects traversal, level geometry, or procedural cave generation.

The best compromise is probably Level 2 with physically informed equations: use the 
3
/
4
3/4-power stalactite profile, radial deposition kernels for stalagmites, and downhill flux accumulation for flowstone. It will look geologically purposeful without requiring computational fluid dynamics.


What about the derived end shapes. Can we rapidly and cheaply extrapolate them from the growth process? With variables for size of resulting objects,  examples I python and alternate in javascript please

Worked for 4m 16s
Yes. The cheap approach is not to simulate every drip. Treat the mature formations as steady-growth or self-similar envelopes, generate a normalized profile once, then scale and perturb it.

Strictly, these formations do not have a final shape: they continue growing while water and carbonate remain available. What we can generate is the mature attractor profile that translates or expands without greatly changing form.

1. Reduced shape models
Stalactite
A broad range of starting forms converges toward a common dimensionless stalactite profile. Far from the rounded tip,

z
∝
r
4
/
3
,
z∝r 
4/3
 ,
so its inverse is

r
∝
z
3
/
4
.
r∝z 
3/4
 .
The full theoretical profile has correction terms, but the 
3
/
4
3/4-power version is an excellent cheap silhouette generator. The published model finds that the ideal profile is parameter-free after rescaling, with natural variations arising from airflow, ripples, water supply and other disturbances. 

For a target height 
H
H and attachment radius 
R
R:

r
(
z
)
=
R
(
1
−
z
H
)
0.75
,
0
≤
z
≤
H
.
r(z)=R(1− 
H
z
​
 ) 
0.75
 ,0≤z≤H.
Here 
z
=
0
z=0 is the ceiling attachment and 
z
=
H
z=H is the tip.

Stalagmite
A recent analytical model gives the slope of a steadily growing stalagmite directly:

d
z
d
r
=
−
u
2
−
[
1
−
(
r
/
R
)
2
]
2
1
−
(
r
/
R
)
2
,
dr
dz
​
 =− 
1−(r/R) 
2
 
u 
2
 −[1−(r/R) 
2
 ] 
2
 
​
 
​
 ,
where

u
=
U
U
0
=
D
a
−
1
.
u= 
U 
0
​
 
U
​
 =Da 
−1
 .
This one parameter produces the principal families:

u
<
1
u<1: flat-topped;

u
≈
1
u≈1: columnar;

u
>
1
u>1: increasingly conical.

For 
u
<
1
u<1, the ideal equation applies only outside

r
c
=
R
1
−
u
,
r 
c
​
 =R 
1−u
​
 ,
and the interior is a flat source region. 

The mathematical surface becomes vertical as 
r
→
R
r→R, producing a logarithmic divergence. For graphics, stop at perhaps 
0.95
R
0.95R–
0.99
R
0.99R, then connect vertically to the floor. 

Flowstone
Flowstone has no single universal profile because its form depends strongly on the wall, cracks and source distribution. The cheap extrapolation is:

Approximate the persistent water paths.

Calculate a time-integrated deposition dose 
D
(
x
,
y
)
D(x,y).

Convert that dose into thickness.

A convenient saturation function is

T
(
x
,
y
)
=
T
max
⁡
[
1
−
exp
⁡
(
−
g
D
(
x
,
y
)
)
]
.
T(x,y)=T 
max
​
 [1−exp(−gD(x,y))].
This gives thin sheets at low flow and thick ribs along persistent rivulets. Draperies and other non-axisymmetric formations are particularly associated with rivulet flow, meandering and instability rather than one universal axisymmetric profile. 

Python
This uses only the standard library for shape generation. The optional drawing example uses Pygame.

from __future__ import annotations

import math
import random
from typing import Iterable, TypeAlias

Point: TypeAlias = tuple[float, float]
HeightField: TypeAlias = list[list[float]]


def stalactite_profile(
    height: float,
    radius: float,
    samples: int = 96,
    exponent: float = 0.75,
    ring_count: float = 0.0,
    ring_amplitude: float = 0.0,
) -> list[Point]:
    """
    Return one side of a stalactite profile.

    Coordinates:
        z = 0      ceiling attachment
        z = height tip
        r          distance from the centre axis

    The returned points run from the attachment edge to the tip.
    """
    if height <= 0:
        raise ValueError("height must be positive")
    if radius <= 0:
        raise ValueError("radius must be positive")
    if samples < 4:
        raise ValueError("samples must be at least 4")
    if not 0.4 <= exponent <= 1.5:
        raise ValueError("exponent is outside a useful range")

    profile: list[Point] = []

    for i in range(samples):
        t = i / (samples - 1)
        z = height * t

        # Universal-profile approximation:
        # z ~ r^(4/3), therefore r ~ z^(3/4).
        r = radius * (1.0 - t) ** exponent

        # Optional crenulations. Fade them out at the attachment and tip.
        if ring_count > 0 and ring_amplitude != 0:
            fade = math.sin(math.pi * t) ** 2
            ripple = math.sin(2.0 * math.pi * ring_count * t)
            r *= 1.0 + ring_amplitude * fade * ripple

        profile.append((max(0.0, r), z))

    profile[-1] = (0.0, height)
    return profile


def stalagmite_profile(
    height: float,
    radius: float,
    shape_ratio: float = 1.0,
    samples: int = 96,
    edge_cutoff: float = 0.97,
) -> list[Point]:
    """
    Return one side of an analytically derived stalagmite profile.

    shape_ratio is u = U / U0 = 1 / Damkohler number.

        shape_ratio < 1: flat-topped
        shape_ratio = 1: columnar
        shape_ratio > 1: conical

    The exact mathematical profile becomes vertical at r = radius.
    edge_cutoff avoids evaluating that singular boundary.

    The returned points run from the floor edge to the apex.
    """
    if height <= 0:
        raise ValueError("height must be positive")
    if radius <= 0:
        raise ValueError("radius must be positive")
    if shape_ratio <= 0:
        raise ValueError("shape_ratio must be positive")
    if samples < 4:
        raise ValueError("samples must be at least 4")
    if not 0.5 <= edge_cutoff < 1.0:
        raise ValueError("edge_cutoff must be in [0.5, 1.0)")

    u = shape_ratio

    # For u < 1, the ideal top remains flat out to this radius.
    flat_top_radius = math.sqrt(max(0.0, 1.0 - u)) if u < 1.0 else 0.0

    normalized_radii = [
        edge_cutoff * i / (samples - 1)
        for i in range(samples)
    ]

    slopes: list[float] = []

    for x in normalized_radii:
        denominator = max(1e-9, 1.0 - x * x)

        if x < flat_top_radius:
            slope = 0.0
        else:
            radicand = u * u - denominator * denominator
            slope = math.sqrt(max(0.0, radicand)) / denominator

        slopes.append(slope)

    # Integrate the slope using the trapezoidal rule.
    vertical_drop = [0.0]

    for i in range(1, samples):
        dx = normalized_radii[i] - normalized_radii[i - 1]
        area = 0.5 * (slopes[i] + slopes[i - 1]) * dx
        vertical_drop.append(vertical_drop[-1] + area)

    total_drop = max(vertical_drop[-1], 1e-9)

    # Axis-to-edge representation.
    axis_to_edge: list[Point] = []

    for x, drop in zip(normalized_radii, vertical_drop):
        r = radius * x
        z = height * (1.0 - drop / total_drop)
        axis_to_edge.append((r, z))

    # Add the small vertical outer wall omitted by edge_cutoff.
    axis_to_edge.append((radius, 0.0))

    # Return floor edge -> apex, matching the stalactite function.
    return list(reversed(axis_to_edge))


def closed_outline(profile: Iterable[Point]) -> list[Point]:
    """
    Mirror an axisymmetric half-profile into a closed 2D polygon.
    """
    right = list(profile)

    if len(right) < 2:
        raise ValueError("profile needs at least two points")

    left = [(-r, z) for r, z in reversed(right)]
    return right + left


def screen_polygon(
    profile: Iterable[Point],
    centre_x: float,
    anchor_y: float,
    hanging: bool,
) -> list[tuple[int, int]]:
    """
    Convert mathematical coordinates to screen coordinates.

    hanging=False:
        anchor_y is the floor; positive z goes upward.

    hanging=True:
        anchor_y is the ceiling; positive z goes downward.
    """
    polygon = closed_outline(profile)
    points: list[tuple[int, int]] = []

    for x, z in polygon:
        screen_x = centre_x + x
        screen_y = anchor_y + z if hanging else anchor_y - z
        points.append((round(screen_x), round(screen_y)))

    return points


def flowstone_heightfield(
    width: float,
    length: float,
    max_thickness: float,
    columns: int = 96,
    rows: int = 128,
    source_count: int = 4,
    ridge_width: float | None = None,
    meander: float | None = None,
    reaction_length: float | None = None,
    growth: float = 2.5,
    sheet_fraction: float = 0.12,
    seed: int = 1,
) -> tuple[list[float], list[float], HeightField]:
    """
    Generate a cheap mature flowstone thickness field.

    width, length and max_thickness may be metres, centimetres or pixels,
    provided the same units are used consistently.

    Returns:
        x coordinates
        y coordinates, source-to-downstream
        thickness[y][x]
    """
    if width <= 0 or length <= 0 or max_thickness <= 0:
        raise ValueError("physical dimensions must be positive")
    if columns < 2 or rows < 2:
        raise ValueError("grid dimensions must be at least 2")
    if source_count < 1:
        raise ValueError("source_count must be positive")

    ridge_width = ridge_width or width * 0.055
    meander = meander or width * 0.08
    reaction_length = reaction_length or length * 0.75

    rng = random.Random(seed)

    xs = [
        -width / 2.0 + width * i / (columns - 1)
        for i in range(columns)
    ]
    ys = [
        length * j / (rows - 1)
        for j in range(rows)
    ]

    margin = width * 0.15

    sources = [
        {
            "x": rng.uniform(-width / 2 + margin, width / 2 - margin),
            "phase1": rng.uniform(0.0, math.tau),
            "phase2": rng.uniform(0.0, math.tau),
            "frequency": rng.uniform(0.7, 1.7),
            "strength": rng.uniform(0.75, 1.25),
        }
        for _ in range(source_count)
    ]

    dose: HeightField = [
        [0.0 for _ in range(columns)]
        for _ in range(rows)
    ]

    for row, y in enumerate(ys):
        downstream_fraction = y / length
        chemical_decay = math.exp(-y / reaction_length)

        # Low-level sheet flow surrounding the stronger rivulets.
        sheet_dose = sheet_fraction * chemical_decay

        for column, x in enumerate(xs):
            value = sheet_dose

            for source in sources:
                path_x = (
                    source["x"]
                    + meander
                    * (
                        0.72
                        * math.sin(
                            math.tau
                            * source["frequency"]
                            * downstream_fraction
                            + source["phase1"]
                        )
                        + 0.28
                        * math.sin(
                            math.tau
                            * 2.37
                            * downstream_fraction
                            + source["phase2"]
                        )
                    )
                )

                distance = (x - path_x) / ridge_width
                rivulet = math.exp(-0.5 * distance * distance)

                value += source["strength"] * rivulet * chemical_decay

            dose[row][column] = value

    # Convert integrated deposition dose to bounded thickness.
    raw = [
        [
            1.0 - math.exp(-growth * value)
            for value in row
        ]
        for row in dose
    ]

    raw_max = max(max(row) for row in raw)

    thickness = [
        [
            max_thickness * value / raw_max
            for value in row
        ]
        for row in raw
    ]

    return xs, ys, thickness
Pygame example
import pygame

pygame.init()

screen = pygame.display.set_mode((900, 650))
clock = pygame.time.Clock()

stalactite = stalactite_profile(
    height=250,
    radius=55,
    ring_count=8,
    ring_amplitude=0.025,
)

flat_stalagmite = stalagmite_profile(
    height=150,
    radius=90,
    shape_ratio=0.55,
)

column_stalagmite = stalagmite_profile(
    height=190,
    radius=65,
    shape_ratio=1.0,
)

conical_stalagmite = stalagmite_profile(
    height=220,
    radius=75,
    shape_ratio=2.0,
)

running = True

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    screen.fill((28, 28, 32))

    # Hanging from ceiling.
    pygame.draw.polygon(
        screen,
        (170, 155, 125),
        screen_polygon(
            stalactite,
            centre_x=160,
            anchor_y=0,
            hanging=True,
        ),
    )

    # Standing on floor.
    pygame.draw.polygon(
        screen,
        (150, 140, 115),
        screen_polygon(
            flat_stalagmite,
            centre_x=400,
            anchor_y=620,
            hanging=False,
        ),
    )

    pygame.draw.polygon(
        screen,
        (165, 150, 120),
        screen_polygon(
            column_stalagmite,
            centre_x=610,
            anchor_y=620,
            hanging=False,
        ),
    )

    pygame.draw.polygon(
        screen,
        (180, 165, 130),
        screen_polygon(
            conical_stalagmite,
            centre_x=790,
            anchor_y=620,
            hanging=False,
        ),
    )

    pygame.display.flip()
    clock.tick(60)

pygame.quit()
A profile requires only around 64–128 points. Cache profiles by parameters, then translate them for every object instance.

JavaScript and Canvas
This mirrors the Python implementation.

"use strict";

/**
 * @typedef {[number, number]} Point
 */


function stalactiteProfile({
    height,
    radius,
    samples = 96,
    exponent = 0.75,
    ringCount = 0,
    ringAmplitude = 0,
}) {
    if (!(height > 0)) {
        throw new Error("height must be positive");
    }

    if (!(radius > 0)) {
        throw new Error("radius must be positive");
    }

    if (samples < 4) {
        throw new Error("samples must be at least 4");
    }

    /** @type {Point[]} */
    const profile = [];

    for (let i = 0; i < samples; i += 1) {
        const t = i / (samples - 1);
        const z = height * t;

        let r = radius * Math.pow(1 - t, exponent);

        if (ringCount > 0 && ringAmplitude !== 0) {
            const fade = Math.pow(Math.sin(Math.PI * t), 2);
            const ripple = Math.sin(
                2 * Math.PI * ringCount * t
            );

            r *= 1 + ringAmplitude * fade * ripple;
        }

        profile.push([Math.max(0, r), z]);
    }

    profile[profile.length - 1] = [0, height];
    return profile;
}


function stalagmiteProfile({
    height,
    radius,
    shapeRatio = 1,
    samples = 96,
    edgeCutoff = 0.97,
}) {
    if (!(height > 0)) {
        throw new Error("height must be positive");
    }

    if (!(radius > 0)) {
        throw new Error("radius must be positive");
    }

    if (!(shapeRatio > 0)) {
        throw new Error("shapeRatio must be positive");
    }

    if (samples < 4) {
        throw new Error("samples must be at least 4");
    }

    if (!(edgeCutoff >= 0.5 && edgeCutoff < 1)) {
        throw new Error("edgeCutoff must be in [0.5, 1)");
    }

    const u = shapeRatio;

    const flatTopRadius = u < 1
        ? Math.sqrt(Math.max(0, 1 - u))
        : 0;

    const radii = [];
    const slopes = [];

    for (let i = 0; i < samples; i += 1) {
        const x = edgeCutoff * i / (samples - 1);
        radii.push(x);

        const denominator = Math.max(
            1e-9,
            1 - x * x
        );

        let slope = 0;

        if (x >= flatTopRadius) {
            const radicand =
                u * u - denominator * denominator;

            slope =
                Math.sqrt(Math.max(0, radicand))
                / denominator;
        }

        slopes.push(slope);
    }

    const verticalDrop = [0];

    for (let i = 1; i < samples; i += 1) {
        const dx = radii[i] - radii[i - 1];

        const area =
            0.5
            * (slopes[i] + slopes[i - 1])
            * dx;

        verticalDrop.push(
            verticalDrop[i - 1] + area
        );
    }

    const totalDrop = Math.max(
        verticalDrop[verticalDrop.length - 1],
        1e-9
    );

    /** @type {Point[]} */
    const axisToEdge = radii.map((x, i) => {
        const r = radius * x;
        const z =
            height
            * (1 - verticalDrop[i] / totalDrop);

        return [r, z];
    });

    axisToEdge.push([radius, 0]);

    return axisToEdge.reverse();
}


function closedOutline(profile) {
    const right = [...profile];

    const left = [...profile]
        .reverse()
        .map(([r, z]) => [-r, z]);

    return right.concat(left);
}


function drawProfile(
    context,
    profile,
    centreX,
    anchorY,
    hanging = false
) {
    const polygon = closedOutline(profile);

    context.beginPath();

    polygon.forEach(([x, z], index) => {
        const screenX = centreX + x;
        const screenY = hanging
            ? anchorY + z
            : anchorY - z;

        if (index === 0) {
            context.moveTo(screenX, screenY);
        } else {
            context.lineTo(screenX, screenY);
        }
    });

    context.closePath();
    context.fill();
}


function flowstoneHeightfield({
    width,
    length,
    maxThickness,
    columns = 96,
    rows = 128,
    sourceCount = 4,
    ridgeWidth = width * 0.055,
    meander = width * 0.08,
    reactionLength = length * 0.75,
    growth = 2.5,
    sheetFraction = 0.12,
    seed = 1,
}) {
    if (!(width > 0 && length > 0 && maxThickness > 0)) {
        throw new Error("dimensions must be positive");
    }

    // Small deterministic pseudorandom number generator.
    function random() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;

        let value = Math.imul(
            seed ^ seed >>> 15,
            1 | seed
        );

        value = value + Math.imul(
            value ^ value >>> 7,
            61 | value
        ) ^ value;

        return (
            (value ^ value >>> 14) >>> 0
        ) / 4294967296;
    }

    function randomRange(minimum, maximum) {
        return minimum + random() * (maximum - minimum);
    }

    const xs = Array.from(
        { length: columns },
        (_, i) =>
            -width / 2
            + width * i / (columns - 1)
    );

    const ys = Array.from(
        { length: rows },
        (_, j) =>
            length * j / (rows - 1)
    );

    const margin = width * 0.15;

    const sources = Array.from(
        { length: sourceCount },
        () => ({
            x: randomRange(
                -width / 2 + margin,
                width / 2 - margin
            ),
            phase1: randomRange(0, Math.PI * 2),
            phase2: randomRange(0, Math.PI * 2),
            frequency: randomRange(0.7, 1.7),
            strength: randomRange(0.75, 1.25),
        })
    );

    const dose = Array.from(
        { length: rows },
        () => new Array(columns).fill(0)
    );

    for (let row = 0; row < rows; row += 1) {
        const y = ys[row];
        const downstreamFraction = y / length;

        const chemicalDecay = Math.exp(
            -y / reactionLength
        );

        const sheetDose =
            sheetFraction * chemicalDecay;

        for (
            let column = 0;
            column < columns;
            column += 1
        ) {
            const x = xs[column];
            let value = sheetDose;

            for (const source of sources) {
                const pathX =
                    source.x
                    + meander
                    * (
                        0.72
                        * Math.sin(
                            Math.PI
                            * 2
                            * source.frequency
                            * downstreamFraction
                            + source.phase1
                        )
                        + 0.28
                        * Math.sin(
                            Math.PI
                            * 2
                            * 2.37
                            * downstreamFraction
                            + source.phase2
                        )
                    );

                const distance =
                    (x - pathX) / ridgeWidth;

                const rivulet = Math.exp(
                    -0.5 * distance * distance
                );

                value +=
                    source.strength
                    * rivulet
                    * chemicalDecay;
            }

            dose[row][column] = value;
        }
    }

    const raw = dose.map(row =>
        row.map(value =>
            1 - Math.exp(-growth * value)
        )
    );

    let rawMaximum = 0;

    for (const row of raw) {
        for (const value of row) {
            rawMaximum = Math.max(
                rawMaximum,
                value
            );
        }
    }

    const thickness = raw.map(row =>
        row.map(value =>
            maxThickness * value / rawMaximum
        )
    );

    return {
        xs,
        ys,
        thickness,
    };
}
Canvas use
<canvas id="cave" width="900" height="650"></canvas>

<script>
const canvas = document.getElementById("cave");
const context = canvas.getContext("2d");

context.fillStyle = "#202024";
context.fillRect(0, 0, canvas.width, canvas.height);

const stalactite = stalactiteProfile({
    height: 250,
    radius: 55,
    ringCount: 8,
    ringAmplitude: 0.025,
});

const flatStalagmite = stalagmiteProfile({
    height: 150,
    radius: 90,
    shapeRatio: 0.55,
});

const conicalStalagmite = stalagmiteProfile({
    height: 220,
    radius: 75,
    shapeRatio: 2.0,
});

context.fillStyle = "#aa9b79";

drawProfile(
    context,
    stalactite,
    180,
    0,
    true
);

drawProfile(
    context,
    flatStalagmite,
    470,
    620,
    false
);

drawProfile(
    context,
    conicalStalagmite,
    750,
    620,
    false
);
</script>
Useful exposed variables
Variable	Visual result
height	Total object length or height
radius	Attachment or base radius
exponent	Stalactite slenderness; approximately 0.75 is physically motivated
ringCount	Number of visible growth ripples
ringAmplitude	Ripple depth; usually 0.01–0.05
shapeRatio	Stalagmite family: flat, columnar or conical
edgeCutoff	Length of near-vertical outer wall
maxThickness	Maximum flowstone relief
sourceCount	Number of persistent rivulets
ridgeWidth	Width of flowstone ribs
meander	Sideways movement of water paths
reactionLength	How far mineral-rich water travels
growth	Contrast between low-flow sheets and thick ribs
For strict physical scaling, the horizontal and vertical axes should generally be scaled together. Supplying arbitrary height and radius independently deliberately stretches the theoretical form to fit a requested game-art bounding box.


You also had drapery and columns. Build those in python too? Or maybe pyga.e, the intention is game art with variables at speed

Worked for 22s
Built as a Pygame sprite generator, not a slow growth simulation.

It includes:

Stalactites using the mature 
r
∝
z
3
/
4
r∝z 
3/4
  profile.

Stalagmites with flat, columnar, and conical shape families.

Joined columns with controllable waist, upper/lower flare, bulges, and lean.

Draperies with ceiling slope, folds, lower-edge waves, taper, thickness, and skew.

Seeded roughness and growth bands.

Transparent pygame.Surface output.

@lru_cache sprite caching for repeated game use.

Download the complete Pygame package

speleothem_demo.png

speleothem_generator.py

Basic use
from speleothem_generator import (
    RockStyle,
    DraperySpec,
    ColumnSpec,
    cached_drapery,
    cached_column,
)

style = RockStyle(
    roughness=0.035,
    bands=6,
)

drapery = cached_drapery(
    DraperySpec(
        width=300,
        height=220,
        ceiling_slope=0.15,
        fold_count=5.0,
        fold_depth=0.18,
        edge_wave_depth=0.10,
        thickness=0.12,
        seed=42,
    ),
    style,
)

column = cached_column(
    ColumnSpec(
        width=130,
        height=400,
        waist=0.65,
        top_flare=0.95,
        bottom_flare=1.15,
        bulges=8,
        bulge_depth=0.04,
        lean=0.025,
        seed=7,
    ),
    style,
)

screen.blit(drapery, (100, 0))
screen.blit(column, (500, 100))
Install with:

py -m pip install pygame-ce
Generate the included test sheet:

py speleothem_generator.py --output speleothem_demo.png --benchmark
On the test environment, the module generated about 1,900 raw outlines per second. Cached sprite retrieval was effectively negligible, so the intended game workflow is to create each seeded variation once and reuse its surface. 







Built as a **Pygame sprite generator**, not a slow growth simulation.

It includes:

* Stalactites using the mature (r \propto z^{3/4}) profile.
* Stalagmites with flat, columnar, and conical shape families.
* Joined columns with controllable waist, upper/lower flare, bulges, and lean.
* Draperies with ceiling slope, folds, lower-edge waves, taper, thickness, and skew.
* Seeded roughness and growth bands.
* Transparent `pygame.Surface` output.
* `@lru_cache` sprite caching for repeated game use.

[Download the complete Pygame package](sandbox:/mnt/data/speleothem_pygame_generator.zip)

[View the generated sprite sheet](sandbox:/mnt/data/speleothem_demo.png)

[Download the Python module directly](sandbox:/mnt/data/speleothem_generator.py)

## Basic use

```python
from speleothem_generator import (
    RockStyle,
    DraperySpec,
    ColumnSpec,
    cached_drapery,
    cached_column,
)

style = RockStyle(
    roughness=0.035,
    bands=6,
)

drapery = cached_drapery(
    DraperySpec(
        width=300,
        height=220,
        ceiling_slope=0.15,
        fold_count=5.0,
        fold_depth=0.18,
        edge_wave_depth=0.10,
        thickness=0.12,
        seed=42,
    ),
    style,
)

column = cached_column(
    ColumnSpec(
        width=130,
        height=400,
        waist=0.65,
        top_flare=0.95,
        bottom_flare=1.15,
        bulges=8,
        bulge_depth=0.04,
        lean=0.025,
        seed=7,
    ),
    style,
)

screen.blit(drapery, (100, 0))
screen.blit(column, (500, 100))
```

Install with:

```powershell
py -m pip install pygame-ce
```

Generate the included test sheet:

```powershell
py speleothem_generator.py --output speleothem_demo.png --benchmark
```

On the test environment, the module generated about **1,900 raw outlines per second**. Cached sprite retrieval was effectively negligible, so the intended game workflow is to create each seeded variation once and reuse its surface.
