## Shaded Teapot

This was completed as a project for my **Computer Graphics (CS 418)** course at [UIUC](https://illinois.edu/). The objective was to render a [Utah Teapot](https://en.wikipedia.org/wiki/Utah_teapot) within skybox, and have complete **Y-axis** rotation for both the teapot model, and the skybox.

The teapot, and skybox functionality is presented through a web-based application built using JavaScript, and WebGL. This is my first big project using the WebGL API, and my first significant 3D computer graphics project.

Provided, are three modes of reflectance for the teapot:

1. Phong reflection
2. Reflective environment mapping 
3. Refractive environment mapping

The web application has a few significant pieces which compose the overall scene:

* HTML5 `canvas` is the primary display medium for outputting the rasterized graphic onto the screen.
* `glMatrix` is used as the main utility for manipulating the matrices, and the vectors required to send through to the vertex, and fragment shaders.
* My own utilities:
  * `gl-compiler.js` - Compiles the vertex, and fragment shaders, and links to a GLSL program
  * `face-iterator.js` - A simple WaveFront `obj` parser which converts the list of vertices, and faces of the triangles in the model into a custom data structure to ease manipulation
* Individual shaders for the various types of reflectance models applied onto the teapot.



### Demo & Code

The application can be demonstrated here: [Shaded Teapot](https://aws-website-rogerngoswebsite-kec4a.s3.amazonaws.com/public/portfolio/teapot/app.html).

If you want to dive right into just reading the code, and running the application, you can download the code from the [GitHub repository here](https://github.com/urbanspr1nter/shaded-teapot).

Running `npm install` is enough to gather all dependencies. To run the basic HTTP server (powered by Express 4) to serve the content, run `node index.js`. The webserver will be exposed through port `3000`.

Navigate to `app.html` to use the demo.

![App](/assets/results/app.jpg)

*Web Application*



### Results

Here are some of the results achieved. I am pretty proud of these. 

You may find a high resolution (3840 x 2160) reflected teapot image through this [download location](/assets/results/4k-teapot-reflected.png). 

 ![Phong reflection teapot](/assets/results/result-phong.jpg) 

*Phong Reflection* 

Here are the settings used to compute the Phong reflectance model;

| Settings                  | Values              |
| ------------------------- | ------------------- |
| Ambient Color - $C_a$   | rgb(0.3, 0.0, 0.0)  |
| Diffuse Color - $C_{d}$ | rgb(0.72, 0.1, 0.1) |
| Specular Color - $C_s$  | rgb(0.3, 0.3, 0.3)  |
| Specular Power            | 3.3                 |

![Reflected environment mapped teapot](/assets/results/result-reflected.jpg) 

*Reflected Environment Mapped*

![Refracted environment mapped teapot](/assets/results/result-refracted.jpg) 

*Refracted Environment Mapped*



### Shader Compilation

For every reflectance model of the teapot, I had decided to program separate shaders for each model. 

Therefore, a total of 3 vertex, and 3 fragment shaders were written to compute the teapot model. The skybox itself was separate vertex, and fragment shader. 

This totals up to 8 different shaders which are compiled, and linked through `gl-compiler.js`. 



### OBJ Parsing

The WaveFront `obj` file is documented [here](https://en.wikipedia.org/wiki/Wavefront_.obj_file), and is pretty easy to understand. The teapot model which I used did not consist of any complex directives, and was just a set of vertices, and faces like so:

```
v 1.38137 2.45469 -9.07128e-006
v 1.4 2.4 -8.86918e-006
v 1.35074 2.4 0.375917
...
f  457 458 459
f  459 458 468
f  468 458 473
...
```

I had developed my own utility, `face-iterator.js` to parse out the `obj` file, and store it in a custom iterable data structure (with API methods such as `next`, `hasNext`, etc).

The data structure itself is an array of objects which contain vertices which make up a triangle. In addition, each element also contains the index of the vertices for which they appear within the `obj` file. 

The sample routine which returns an element is shown:

```
/**
 * Returns a simple data structure representing a triangle face.
 * {
 *  v1: first vertex,
 *  v2: second vertex,
 *  v3: third vertex,
 *  indices: object which contains a mapping of the vertex to its
*            index within the obj file.
 * }
 */
FaceIterator.prototype.next = function() {
    const indices = this.faces[this.faceIndex];

    const result = {
        v1: glMatrix.vec3.fromValues(...this.getVertex(indices[0])),
        v2: glMatrix.vec3.fromValues(...this.getVertex(indices[1])),
        v3: glMatrix.vec3.fromValues(...this.getVertex(indices[2])),
        indices: {
            v1: indices[0],
            v2: indices[1],
            v3: indices[2]
        }
    };

    this.faceIndex++;

    return result;
}
```



### Gouraud Interpolated Shading

In order to create an aesthetic render of the model, I had used Gouraud interpolated shading as opposed to flat-shading.

Flat shading takes each face normal, and uses the normal to compute the color for the entire triangle. This results in mach bands appearing on the shape as there is no seamless transition in color.

With Gouraud shading, the average of the face normals which are incident (adjacent triangles) to the current triangle is used instead to interpolate the colors across the surface of the triangle between the vertices. This results in smooth shading as shown in the comparison below:

![Flat vs Goouraud](https://upload.wikimedia.org/wikipedia/commons/6/62/D3D_Shading_Modes.png)

How do we do this? For the 2D case, we can just take each segment, and compute the normals between each vertex, and obtain the average between them.

![2D Normal](/assets/results/2d_average_normals.jpg)

The 3D case is not as trivial. In order to perform Gouraud shading, each triangle face normal $$\vec{f}_i$$ is computed.

![Triangle](/assets/results/face_normal.jpg)

$$\vec{n} = (X_1 - X_0) \times (X_2 - X_0)$$ 

Using each face normal, $\vec{f}_i$, the average $\overline{\vec{f}_{i...j}}$ is computed from all triangles adjacent to the current triangle. 

Some data juggling is involved to find out which triangles are adjacent to each other, but it is solved easier by the use of a *dictionary*, or *map-like* data structure. 

In the case of JavaScript, we can use a plain object with its object properties being the vertex index pointing to the list of normals of the triangles, which contain that vertex.

Here is an example representation of this map structure:

```
t1: v1 v2 v3
t2: v1 v4 v2
t3: v4 v5 v2
t4: v2 v5 v3

map = {}

map[v1] = [N1, N2]
map[v2] = [N1, N2, N3, N4]
map[v3] = [N1, N4]
map[v4] = [N2, N3]
map[v5] = [N3, N4]
```

Although more memory is used initially to store the face normals before computing the average of normals, we only need to do this once offline. 

The normals will be recalculated using these initial values against a matrix transformation when computing the lighting.



### Cube Mapping & Skybox

I primarily followed the WebGL fundamentals tutorial on [Cube Mapping](https://webglfundamentals.org/webgl/lessons/webgl-cube-maps.html) to build the reflected, and refracted teapot. It was not too troublesome, and found the tutorial to get me up and running very quickly.

For the skybox, the subsequent [tutorial](https://webglfundamentals.org/webgl/lessons/webgl-cube-maps.html) on WebGL fundamentals had good enough documentation to sample off of. The only quirk in the tutorial in contrast to the final code is that glMatrix uses `targetTo` as the equivalent version of an inverse `lookAt` as demonstrated in the tutorial.

![Skybox](/assets/results/skybox.gif)

Setting up the matrix was probably the most challenging. There were two parts to this:

1. Set up the matrix for the reflected/refracted teapot
2. Set up the matrix for the skybox

One thing to keep in mind is that the camera matrix is inverted after setting the target using `targetTo`. 



### Phong Reflectance Model

The Phong reflectance model can be expressed as the sum of three components:

* Ambient light intensity
* Diffuse light intensity
* Specular light intensity



The specular component of the Phong reflectance model is what gives the teapot the gleam required to make it look "plastic-y". 

Given a directional light intensity $I_{dir}$, the specular component is expressed as:

$$I_{spec} = I_{dir}k_{s}C_{s} cos (\delta)^s$$

There are two important components to consider in the specular model:

1. The intensity of the light as seen by the viewer. This is the angle, $\delta$ at which the light is reflected by the vector $\vec{r}$ from the surface to the viewer $\vec{e}$.
2. The specular power, $s$ or the rate of the drop-off in intensity as $\delta$ changes when the light is reflected from the surface, back to the direction of the viewer as the vector $\vec{r}$.

The following diagrams show the teapot with the lighting components separated:

| Lighting Component | Image                                                        |
| ------------------ | ------------------------------------------------------------ |
| Ambient            | ![Ambient](/assets/results/phong_ambient.jpg) |
| Diffuse            | ![Diffuse](/assets/results/phong_diffuse.jpg) |
| Specular           | ![Specular](/assets/results/phong_specular.jpg) |
| **Composite**      | ![Combined](/assets/results/phong_phong.jpg) |



### Camera

The camera is configured to look at the $-z$ axis, focusing on the teapot in the position $[0, 0, 2]$. The view volume is configured with $45^\circ$ FOV, and z-clipping from $1.0$ at the near plane, to $2000.0$ at the far plane.

This perspective focuses on $(0, 0, 0)$, with the up-direction at the Y-axis: $(0, 1, 0)$. The camera matrix uses the eye point $(0, 0, 2)$, focus point, and up-direction to build the `lookAt` matrix, and is then inverted to target the teapot.

When the application is loaded, the default view is then towards the -Z-axis.



### Conclusion

Overall, this was a very fun project to work on. I learned a lot of computer graphics concepts which I have been wanting to learn for quite some time, but just hadn't found time to! This project was a great motivator for me to buckle down, and learn some basic CG concepts:

* Basic vertex, and fragment shader programming
* Reflectance models
* Environment mapping
* 3D camera transformations



----

### Resources

* WebGL Fundamentals - https://webglfundamentals.org/
  * I learned a lot of WebGL through these tutorials. :smile:
* Humus - http://www.humus.name/
  * Some of the cube mapped images for the skybox were taken from here. They are really good!

