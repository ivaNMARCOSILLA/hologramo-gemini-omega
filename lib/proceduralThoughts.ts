export class ProceduralThoughts {
  private static subjects = [
    "el silencio espeso de una casa vacía",
    "la obsesión de acumular cosas rotas en cajones",
    "el pudor absurdo de mostrar debilidad en público",
    "la frialdad con la que olvidamos promesas antiguas",
    "el miedo involuntario al escuchar pasos en la oscuridad",
    "el desprecio hacia quienes solo buscan la aprobación ajena",
    "la vergüenza de admitir que nos hemos equivocado de oficio o camino"
  ];

  private static reactions = [
    "me hace pensar que vivimos interpretando un papel que ni siquiera elegimos.",
    "demuestra que nuestra supuesta lógica es solo una tapadera para el miedo.",
    "deja al descubierto que nos importa más el orgullo que la propia tranquilidad.",
    "sugiere que buscamos compañía solo para no escuchar nuestras propias dudas."
  ];

  private static questions = [
    "¿En qué momento decidiste que era mejor callar que defender lo tuyo?",
    "¿Qué parte de tu rutina mantienes por pura cobardía al cambio?",
    "¿A quién le debes una disculpa sincera que sabes que nunca vas a dar?",
    "¿Qué convicción que tenías a los veinte años se te ha desmoronado por completo?"
  ];

  public static generate(entity: "ALFA" | "BETA"): string {
    const s = this.subjects[Math.floor(Math.random() * this.subjects.length)];
    const r = this.reactions[Math.floor(Math.random() * this.reactions.length)];
    const q = this.questions[Math.floor(Math.random() * this.questions.length)];

    return entity === "ALFA"
      ? `Fijándome en ${s}, eso ${r} ${q}`
      : `Contemplar ${s} solo confirma que ${r} Dime: ${q}`;
  }
}
