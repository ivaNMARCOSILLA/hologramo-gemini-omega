import { NextRequest, NextResponse } from "next/server";
import * as tf from "@tensorflow/tfjs";
import { AutonomousNeuralAgent } from "@/lib/neuralAgent";

let agentAlfa: AutonomousNeuralAgent | null = null;
let agentBeta: AutonomousNeuralAgent | null = null;
let currentPulse: tf.Tensor2D | null = null;

function initializeEcosystem() {
  if (!agentAlfa || !agentBeta) {
    agentAlfa = new AutonomousNeuralAgent("Alfa", 64);
    agentBeta = new AutonomousNeuralAgent("Beta", 64);
    currentPulse = tf.keep(tf.randomNormal([1, 64])) as tf.Tensor2D;
  }
}

export async function POST(req: NextRequest) {
  // OMEGA_PREVIEW_NO_PUBLIC_TRAINING_V12
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Ruta local no disponible en la web publica' }, { status: 403 });
  try {
    initializeEcosystem();

    const { agentToTrain } = await req.json();
    const isAlfa = agentToTrain === "A" || agentToTrain === "ALFA";

    const activeAgent = isAlfa ? agentAlfa! : agentBeta!;
    const { outputThought, curiosityLoss } = activeAgent.step(currentPulse!);

    const oldPulse = currentPulse;
    currentPulse = tf.keep(outputThought.clone());
    if (oldPulse) oldPulse.dispose();

    const latentValues = Array.from(outputThought.dataSync()).slice(0, 8);
    const synapticEnergy = latentValues.reduce((acc, val) => acc + Math.abs(val), 0) / latentValues.length;

    return NextResponse.json({
      agent: activeAgent.name,
      curiosityLoss: Number(curiosityLoss.toFixed(4)),
      synapticEnergy: Number(synapticEnergy.toFixed(4)),
      latentVectorHead: latentValues.map((v) => Number(v.toFixed(3))),
      status: "Backpropagation online completada con éxito"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

