import * as tf from "@tensorflow/tfjs";

export class AutonomousNeuralAgent {
  public name: string;
  public model: tf.Sequential;
  public optimizer: tf.Optimizer;
  public memoryVector: tf.Tensor2D;
  private latentDim: number;

  constructor(name: string, latentDim: number = 64) {
    this.name = name;
    this.latentDim = latentDim;
    this.optimizer = tf.train.adam(0.005);
    
    // Vector de estado interno inicial
    this.memoryVector = tf.randomNormal([1, this.latentDim]);

    // Red Neuronal: Entrada de tensores combinados -> Proyección latente
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({
      inputShape: [this.latentDim * 2],
      units: 128,
      activation: "elu",
      kernelInitializer: "glorotNormal"
    }));
    this.model.add(tf.layers.dense({
      units: 128,
      activation: "tanh"
    }));
    this.model.add(tf.layers.dense({
      units: this.latentDim,
      activation: "tanh"
    }));
  }

  public step(incomingThought: tf.Tensor2D): { outputThought: tf.Tensor2D; curiosityLoss: number } {
    return tf.tidy(() => {
      const stateInput = tf.concat([this.memoryVector, incomingThought], 1);
      const outputThought = this.model.predict(stateInput) as tf.Tensor2D;

      // Cálculo de pérdida intrínseca (búsqueda de novedad conceptual)
      const distance = tf.losses.meanSquaredError(this.memoryVector, outputThought);
      const noveltyLoss = tf.sub(1.0, distance) as tf.Scalar;

      // Retropropagación y optimización de pesos en caliente
      this.optimizer.minimize(() => {
        const pred = this.model.predict(stateInput) as tf.Tensor2D;
        const currentDist = tf.losses.meanSquaredError(this.memoryVector, pred);
        return tf.sub(1.0, currentDist) as tf.Scalar;
      });

      const oldMem = this.memoryVector;
      this.memoryVector = tf.keep(outputThought.clone());
      oldMem.dispose();

      const lossValue = noveltyLoss.dataSync()[0];
      return { outputThought, curiosityLoss: lossValue };
    });
  }
}
