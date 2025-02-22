import * as THREE from '../lib/three.js';
import Perlin from '../lib/perlin.js'
import Erode from './Erode.js'

export default class Plane {

    constructor(wireframe, subdivs) {

        this.max = 0;

        this.vertColorData = []
        this.wSeg = this.hSeg = subdivs
        this.geometry = new THREE.PlaneGeometry(20, 20, this.wSeg, this.hSeg);
        // this.geometry = new THREE.BoxGeometry( 5, 5, 5, this.wSeg, this.hSeg)
        this.isWire = wireframe
        this.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            flatShading: false,
            wireframe: this.isWire,
            side: THREE.DoubleSide,
            vertexColors: THREE.VertexColors,

            roughness: 1,
            metalness: 0,

        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.rotation.x = Math.PI / 2 + Math.PI
        this.mesh.name = 'main'

        this.tris = this.mesh.geometry.faces.length
        this.verts = this.mesh.geometry.vertices.length
        this.modifier = new Erode(this.geometry, this.wSeg)
    }

    displace(preserveSeed, seed) {
        let mode = sessionStorage.getItem('shading')
        let timerStart = Date.now();
        this.resetNormals();

        if (preserveSeed) {
            this.seed = seed
        } else {
            this.seed = (sessionStorage.getItem('seed') === null || sessionStorage.getItem('seed') === '') ? Math.random() : sessionStorage.getItem('seed')
        }
        let pn = new Perlin(this.seed);

        let octaves = 8
        let scale = 0.06
        let persistance = 2
        let lacunarity = 2

        for (var i = 0; i < this.mesh.geometry.vertices.length; i++) {
            let total = 0;
            let frequency = 1;
            let amplitude = 1;

            let x = this.mesh.geometry.vertices[i].x
            let y = this.mesh.geometry.vertices[i].y

            for (var j = 0; j < octaves; j++) {

                let noise = pn.noise(x / (scale * frequency), y / (scale * frequency), 0);
                total += (noise * amplitude);
                amplitude *= persistance;
                frequency *= lacunarity;
            }
            this.mesh.geometry.vertices[i].z = total / 15 - 5
            this.max = (total > this.max) ? total : this.max

            this.vertColorData.push(total)

        }

        if (mode === 'real') {
            this.geometry.computeVertexNormals();
        }

        this.geometry.verticesNeedUpdate = true;
        this.tris = this.mesh.geometry.faces.length
        this.verts = this.mesh.geometry.vertices.length
        return Date.now() - timerStart
    }

    color() {
        let mode = sessionStorage.getItem('color')

        this.geometry.computeBoundingBox();
        let zMin = this.geometry.boundingBox.min.z;
        let zMax = this.geometry.boundingBox.max.z;
        let zRange = zMax - zMin;
        let color, point, face, numberOfSides, vertexIndex;
        
        

        // faces are indexed using characters
        let faceIndices = ['a', 'b', 'c', 'd'];

        // first, assign colors to vertices as desired
        for (let i = 0; i < this.geometry.vertices.length; i++) {
            point = this.geometry.vertices[i];

            if (mode === 'clay') {
                color = new THREE.Color(0xffffff);
                let calc = (0.7 * (point.z) / zRange)
                color.setRGB(calc, calc, calc)
            } else if(mode === 'heatmap') {
                color = new THREE.Color(0x0000ff);
                let calc = 0.1 * (zMax - point.z) / zRange
                color.setHSL(calc, 1, 0.5);
            }
            this.geometry.colors[i] = color; // use this array for convenience

            //-----------------------------------------------------------------------------

            // point = this.geometry.vertices[i]
            // color = new THREE.Color(0x000000);
            // let b = 255 * this.geometry.dropletData.waterLevel[i]
            // let g = 255 * this.geometry.dropletData.sedimentLevel[i]
            // color.b = b
            // color.g = g
            // this.geometry.colors[i] = color
        }

        this.geometry.colors[0] = new THREE.Color(0xff0000)

        // copy the colors as necessary to the face's vertexColors array.
        for (let i = 0; i < this.geometry.faces.length; i++) {
            face = this.geometry.faces[i];
            numberOfSides = (face instanceof THREE.Face3) ? 3 : 4;
            for (var j = 0; j < numberOfSides; j++) {
                vertexIndex = face[faceIndices[j]];
                face.vertexColors[j] = this.geometry.colors[vertexIndex];
            }

        }

        this.geometry.elementsNeedUpdate = true
    }

    generateMap() {

        let canvasRes = (this.wSeg > 256) ? 256 : this.wSeg

        var c = document.querySelector(".myCanvas canvas");

        c.width = c.height * (c.clientWidth / c.clientHeight);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "blue";
        ctx.fillRect(0, 0, c.width, c.height);
        var imgData = ctx.createImageData(canvasRes + 1, canvasRes + 1);

        let mapData = new Uint8ClampedArray(imgData.data.length)
        let dataind = 0;
        for (var i = 0; i < this.geometry.colors.length; i += 1) {
            mapData[dataind + 0] = this.geometry.colors[i].r * 255;
            mapData[dataind + 1] = this.geometry.colors[i].g * 255;
            mapData[dataind + 2] = this.geometry.colors[i].b * 255;
            mapData[dataind + 3] = 255;
            dataind += 4
        }
        for (let i = 0; i < imgData.data.length; i++) {
            imgData.data[i] = mapData[i]
        }

        // create a temporary canvas
        var tempCanvas = document.createElement("canvas");
        var tempCtx = tempCanvas.getContext("2d");

        // set the temp canvas size == the canvas size
        tempCanvas.width = c.width;
        tempCanvas.height = c.height;

        // put the modified pixels on the temp canvas
        tempCtx.putImageData(imgData, 0, 0);

        // use the tempCanvas.toDataURL to create an img object
        var img = new Image();


        img.onload = function() {
            // drawImage the img on the canvas
            ctx.drawImage(img, 0, 0)
        }
        img.src = tempCanvas.toDataURL();

        let scalingFactor = 256 / canvasRes

        ctx.scale(scalingFactor, scalingFactor)


    }

    recalcNormals() {
        let mode = sessionStorage.getItem('shading')
        let seed = sessionStorage.getItem('seed')
        
        switch (mode) {
            case 'real':
                this.displace(true, seed)
                this.modifier.erode()
                break;
        
            case 'stylized':
                this.resetNormals()
                break;
        
            default:
                return -1
        }

        
    }

    resetNormals() {
        for (var i = 0; i < this.mesh.geometry.vertices.length; i++) {
            this.mesh.geometry.vertices[i].z = 0;
        }
        this.geometry.computeVertexNormals();
    }

    


}