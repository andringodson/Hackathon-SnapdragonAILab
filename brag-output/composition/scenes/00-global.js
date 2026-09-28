/* Film-wide keyframes: chapters, the HUD, and how lit the matrix field is. */
(() => {
  const { E, clamp, lerp } = R;

  /** A keyframed value: [[T, v], ...], eased between keys. */
  R.track = (keys, ease = E.inOutSine) => (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
      if (T <= tb) return lerp(va, vb, ease(clamp((T - ta) / Math.max(1e-6, tb - ta))));
    }
    return keys[keys.length - 1][1];
  };

  [[0, "The line"], [10, "The problem"], [20, "Sahaay"], [30, "On screen"], [46, "22 languages"],
   [62, "Offline"], [72, "The NPU"], [96, "Built to be checked"], [108, "Try it"]]
    .forEach(([T, name], i) => R.chapter(T, i + 1, name));

  R.hudLevel = R.track([[0, 0], [2.4, 0], [3.4, 0.9], [19.6, 0.9], [19.8, 0], [21.6, 0], [22.6, 0.9], [117.5, 0.9], [119, 0]]);

  R.bgLevel = R.track([
    [0, 0], [1.0, 0.25], [2.8, 0.75], [9.4, 0.75], [9.8, 1], [10.4, 0.8],
    [19.3, 0.9], [19.85, 0], [20.2, 0], [20.6, 1], [29.5, 0.9],
    [30.2, 0.7], [45.6, 0.7], [46.5, 0.85], [61.5, 0.85], [62, 0.55],
    [64.0, 0.55], [64.05, 0.15], [69.5, 0.25], [70.5, 0.7], [72, 0.8],
    [95.5, 0.8], [96, 0.9], [107.5, 0.9], [108.5, 0.7], [118.6, 0.7], [119.9, 0],
  ]);
  const red = R.track([[10.5, 0], [12, 0.25], [18.4, 0.55], [19.5, 0.8], [19.8, 0],
                       [77.95, 0], [78.15, 0.8], [82.6, 0.55], [83.6, 0]]);
  R.bgTint = (T) => {
    const k = red(T);
    return k > 0.01 ? `rgba(255, 59, 107, ${k.toFixed(3)})` : null;
  };
})();
