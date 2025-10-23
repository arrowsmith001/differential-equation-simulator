import * as THREE from "three";

export function getDefaultAxesColors() {

  const defaultAxis = new THREE.AxesHelper(1);
  const array = defaultAxis.geometry.attributes.color.array;
  const axisColors = ["x", "y", "z"].reduce<{ start: THREE.Color, end: THREE.Color }[]>((acc, axis, i) => {
    // Each axis has 2 vertices, each with RGB (3 floats)
    const startIndex = i * 6;       // 2 vertices * 3 components
    const endIndex = startIndex + 3;

    const startColor = new THREE.Color(
      array[startIndex],
      array[startIndex + 1],
      array[startIndex + 2]
    );
    const endColor = new THREE.Color(
      array[endIndex],
      array[endIndex + 1],
      array[endIndex + 2]
    );

    acc.push({
      start: startColor,
      end: endColor,
    });
    return acc;
  }, []);

  return axisColors;
}

export function applyAxesColors(axesHelper: THREE.AxesHelper, storedColors: { start: THREE.Color, end: THREE.Color }[], excluded?: number[]) {
  const colorArray = axesHelper.geometry.attributes.color.array;

  ["x", "y", "z"].forEach((axis, i) => {

    if (excluded !== undefined && excluded.includes(i)) {
      // apply white
      const startIndex = i * 6;
      const endIndex = startIndex + 3;
      colorArray[startIndex] = 0.1;
      colorArray[startIndex + 1] = 0.1;
      colorArray[startIndex + 2] = 0.1;
      colorArray[endIndex] = 0.1;
      colorArray[endIndex + 1] = 0.1;
      colorArray[endIndex + 2] = 0.1;
      return;
    }

    const startIndex = i * 6;
    const endIndex = startIndex + 3;

    const sc = storedColors[i].start;
    const ec = storedColors[i].end;

    colorArray[startIndex] = sc.r;
    colorArray[startIndex + 1] = sc.g;
    colorArray[startIndex + 2] = sc.b;

    colorArray[endIndex] = ec.r;
    colorArray[endIndex + 1] = ec.g;
    colorArray[endIndex + 2] = ec.b;
  });

  axesHelper.geometry.attributes.color.needsUpdate = true;
  axesHelper.material.vertexColors = true;
}