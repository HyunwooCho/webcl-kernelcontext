// kernel for computing the energy on the sphere
var energyKernelSource = "__kernel void clEnergyKernel(__global float* points, __global float* result, int n) { \
    unsigned int i = get_global_id(0); \
    if (i >= n * 3) \
        return; \
\
    float total = 0.0; \
    for (int j = 0; j < n; j++) \
        if (i != j) \
            total += sqrt(pow(points[3*i] - points[3*j], 2) + pow(points[3*i+1] - points[3*j+1], 2) + pow(points[3*i+2] - points[3*j+ 2], 2)); \
    result[i] = total; \
}";

$(function() {
    /**
     * Generate random points on a sphere
     *
     */
    function generate(points, n) {
        for (var i = 0; i < n; i++) {
            // generate random points in polar coordinates
            var theta = Math.random() * 2 * Math.PI;
            var u = (Math.random() * 2) - 1;

            // save x, y, and z values
            points[3 * i] = Math.sqrt(1 - u * u) * Math.cos(theta);
            points[3 * i + 1] = Math.sqrt(1 - u * u) * Math.sin(theta);
            points[3 * i + 2] = u;
        }
    }

    /**
     * Compute the total energy from a result array
     *
     */
    function energy(result, n) {
        var total = 0.0;
        for (var i = 0; i < n; i++)
            total += result[i];

        return total;
    }

    // generate n random points on a sphere
    var n = 16;
    var points = new Float32Array(n * 3);
    var result = new Float32Array(n);

    // connect to gpu
    var tmcl = new TMCL;

    // compile kernel from source
    var energyKernel = tmcl.compile(energyKernelSource, 'clEnergyKernel');
    var resultHandle = tmcl.toGPU(result);

    // generate a new, random set of points
    generate(points, n);

    // try a different number of energy computations
    var runs = 5;
    var dt = 1;
    var min = Number.MAX_VALUE;
    var energies = [];
    for (var i = 0; i < runs; i++) {
        // send data to gpu
        var pointsHandle = tmcl.toGPU(points);

        // compute energies for this configuraton
        var local = n / 2;
        var global = n;
        energyKernel({
            local: local,
            global: global
        }, pointsHandle, resultHandle, new Int32(n));

        // get energies from GPU, check if we found a better configuration
        tmcl.fromGPU(resultHandle, result);
        var e = energy(result, n);
        if (e < min)
            min = e;

        // remember all computed energies
        energies.push(e);

        // compute new locations for points
        for (var j = 0; j < n; j++) {
            // multiply each point by the force acting upon it
            points[3 * j] = Math.abs(points[3 * j] * result[j] * dt);
            points[3 * j + 1] = Math.abs(points[3 * j + 1] * result[j] * dt);
            points[3 * j + 2] = Math.abs(points[3 * j + 2] * result[j] * dt);

            // re-normalize coordinates
            var length = Math.sqrt(Math.pow(points[3 * j], 2) + Math.pow(points[3 * j + 1], 2) + Math.pow(points[3 * j + 2], 2));
            points[3 * j] = points[3 * j] / length;
            points[3 * j + 1] = points[3 * j + 1] / length;
            points[3 * j + 2] = points[3 * j + 2] / length;
        }
    }

    console.log('Energies', energies);
    console.log('Minimum energy', min);
});
