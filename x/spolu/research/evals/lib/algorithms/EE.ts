import PQueue from "p-queue";
import seedrandom from "seedrandom";

import { Algorithm, AlgorithmType, TestResult } from "@app/lib/algorithms";
import { Dataset, Test } from "@app/lib/datasets";
import { ChatMessage, ChatQuery, Model } from "@app/lib/models";

type Explanation = {
  explanation: string;
  answer: string;
  check: boolean;
  judgements: string[];
};

export class EE extends Algorithm {
  readonly N_SHOT = 8;
  readonly POOL_SIZE = 32;
  readonly TEMPERATURE = 0.7;
  readonly JUDGEMENTS_DEPTH = 4;
  readonly GENERATIONS = 4;
  readonly MAX_CROSSOVERS = 3;
  readonly INNER_CONCURRENCY = 4;
  readonly USE_INSIGHTS = false;

  private generationResults: TestResult[][];
  private insights: { [key: string]: string[] };

  constructor(dataset: Dataset, model: Model) {
    super(dataset, model);
    this.generationResults = [];
    this.insights = {};
    console.log(
      "Predicted runs per problem:" +
        (this.POOL_SIZE +
          this.GENERATIONS * ((this.JUDGEMENTS_DEPTH + 1) * this.POOL_SIZE))
    );
  }

  algorithm(): AlgorithmType {
    return "EE";
  }

  taskPrompt(): string {
    let prompt = "";
    prompt += `${this.dataset.instructions()}`;
    prompt += "\n\n";
    prompt += `Provide a reasoning consisting in multiple steps.`;
    prompt += ` ${this.dataset.reasoningStepInstructions()}`;
    return prompt;
  }

  explanativePrompt(): string {
    let prompt = "";
    prompt += `A good explanation is dense, minimal, deductive, accurate and precise.`;
    prompt += ` It should be clearly understandable by domain experts,`;
    prompt += ` ommiting trivial or unecessary details`;
    prompt += ` and including all the necessary steps to convincingly reach the conclusion.`;
    prompt += ` A bad explantion is one that includes mistakes or incorrect reasoning,`;
    prompt += ` can be simplified, includes unecessary steps or is based on incorrect assumptions or facts.`;
    return prompt;
  }

  async initializePool({
    test,
    iteration,
  }: {
    test: Test;
    iteration?: number;
  }): Promise<Explanation> {
    const examples = this.dataset.examples({
      problem: test.id,
      count: this.N_SHOT,
      iteration: iteration ? iteration : 0,
    });

    const messages: ChatMessage[] = [];

    let prompt = `<Instructions>\n`;
    prompt += this.taskPrompt();
    prompt += `\n</Instructions>`;

    for (const e of examples.slice(0, this.N_SHOT / 2)) {
      prompt += `\n\n<Example>\n`;
      prompt += `QUESTION: ${e.question}\n`;
      prompt += `REASONING:\n${e.reasoning.join("\n")}\n`;
      prompt += `ANSWER: ${e.answer}\n`;
      prompt += `</Example>`;
    }

    messages.push({
      role: "system",
      content: prompt,
    });

    for (const e of examples.slice(this.N_SHOT / 2)) {
      messages.push({
        role: "user",
        content: `QUESTION: ${e.question}`,
      });
      messages.push({
        role: "assistant",
        content: `REASONING:\n${e.reasoning.join("\n")}\nANSWER: ${e.answer}`,
      });
    }

    messages.push({
      role: "user",
      content: `QUESTION: ${test.question}`,
    });

    messages.forEach((m) => {
      console.log(`+++++++++++++++++++++++++++++++`);
      console.log(`[${m.role}]`);
      console.log(`-------------------------------`);
      console.log(`${m.content}`);
    });

    const query: ChatQuery = {
      provider: this.model.provider,
      model: this.model.model(),
      messages,
      temperature: this.TEMPERATURE,
      maxTokens:
        this.dataset.maxTokens().reasoningStep *
        this.dataset.maxTokens().maxStepCount,
    };

    const c = await this.runCompletion(query);

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(`INITIALIZATION test=${test.id} iteration=${iteration}`);
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(c.content);
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<");

    const answer = this.dataset.parseAnswer(c.content);

    let check = false;
    try {
      check = await this.dataset.check({ test, answer });
    } catch (e) {
      // Nothing to do, check failed.
    }

    console.log("-------------------------");
    console.log(`PROBLEM: ${test.id}`);
    console.log(`ANSWER: ${answer}`);
    console.log(`CHECK: ${check}`);
    console.log("-------------------------");
    console.log("\n\n\n");

    await this.storeCompletion({
      test,
      completion: c,
      query,
      check,
    });
    this.stats();

    return {
      answer,
      check,
      explanation: c.content,
      judgements: [],
    };
  }

  async judgeExplanation({
    test,
    explanation,
    generation,
    iteration,
  }: {
    test: Test;
    explanation: Explanation;
    generation: number;
    iteration: number;
  }) {
    let currentInsights: string | null = null;
    if (this.insights[test.id] && this.insights[test.id].length > 0) {
      currentInsights =
        this.insights[test.id][this.insights[test.id].length - 1];
    }

    const messages: ChatMessage[] = [];

    let prompt = `<Instructions>\n`;
    prompt += `<Task>\n`;
    prompt += this.taskPrompt();
    prompt += `\n</Task>\n\n`;
    prompt += this.explanativePrompt();
    prompt += `\n\n`;
    prompt += `As domain expert, be precise about what you think is good or bad in the proposed explanation.`;
    prompt += ` Focus on checking its correctness and propose ways to improve it.`;
    prompt += `\n\n`;
    if (explanation.judgements.length === 0) {
      prompt += `Produce a (200 words/symbols max, be as dense as possible) commentary/judgement of the explanation`;
    } else {
      prompt += `Judge (200 words/symbols max, be as dense as possible) the commentaries made by other experts on the explanation`;
    }
    prompt += ` proposed to answer the following question:`;
    prompt += `\n\n`;
    prompt += `<Question>\n`;
    prompt += `${test.question}`;
    prompt += `\n</Question>`;
    if (this.USE_INSIGHTS && currentInsights) {
      prompt += `\n\n`;
      prompt += `Leverage the insights about the question accumulated from previous rounds of`;
      prompt += ` explanations and judgements to avoid common pitfalls and reinforce convincing ideas.`;
      prompt += `\n\n<Insights>\n${currentInsights}\n</Insights>`;
    }
    prompt += `\n</Instructions>`;

    messages.push({
      role: "system",
      content: prompt,
    });

    let content = `The explanation to comment/judge:\n\n${explanation.explanation}`;

    if (explanation.judgements.length > 0) {
      content += `\n\n`;
      content += `The commentaries made by other experts to judge/comment:`;
      for (let i = 0; i < explanation.judgements.length; i++) {
        content += `\n\nEXPERT ${i}:\n\n${explanation.judgements[i]}`;
      }
    }

    messages.push({
      role: "user",
      content,
    });

    messages.forEach((m) => {
      console.log(`+++++++++++++++++++++++++++++++`);
      console.log(`[${m.role}]`);
      console.log(`-------------------------------`);
      console.log(`${m.content}`);
    });

    const query: ChatQuery = {
      provider: this.model.provider,
      model: this.model.model(),
      messages,
      temperature: this.TEMPERATURE,
      maxTokens: 512,
    };

    const c = await this.runCompletion(query);

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(
      `JUDGEMENT test=${test.id} generation=${generation} iteration=${iteration}`
    );
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(c.content);
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<");
    console.log("\n\n\n");

    await this.storeCompletion({
      test,
      completion: c,
      query,
      check: false,
    });
    this.stats();

    explanation.judgements.push(c.content);
  }

  async crossOver({
    test,
    pool,
    generation,
    iteration,
  }: {
    test: Test;
    pool: Explanation[];
    generation: number;
    iteration: number;
  }): Promise<Explanation> {
    const rng = seedrandom(
      `EE-CROSSOVER-${test.id}-${generation}-${iteration}`
    );

    let currentInsights: string | null = null;
    if (this.insights[test.id] && this.insights[test.id].length > 0) {
      currentInsights =
        this.insights[test.id][this.insights[test.id].length - 1];
    }

    // choose a random number between 2 and this.MAX_CROSSOVERS using rng
    const crossOvers = Math.floor(rng() * (this.MAX_CROSSOVERS - 2)) + 2;

    // pick this.CROSSOVERS explanations at random using rng
    const explanations: Explanation[] = [];
    const indexes: number[] = [];
    for (let i = 0; i < crossOvers; i++) {
      let index = Math.floor(rng() * pool.length);
      while (indexes.includes(index)) {
        index = Math.floor(rng() * pool.length);
      }
      explanations.push(pool[index]);
    }

    const messages: ChatMessage[] = [];

    let prompt = `<Instructions>\n`;
    prompt += `<Task>\n`;
    prompt += this.taskPrompt();
    prompt += `\n</Task>\n\n`;
    prompt += this.explanativePrompt();
    prompt += `\n\n`;
    prompt += `Based on the following ${crossOvers} explanation proposal${
      crossOvers === 1 ? "" : "s"
    }`;
    prompt += ` and associated commentaries/judgements made by domain experts,`;
    prompt += ` propose an improved explanation to answer the question:`;
    prompt += `\n\n`;
    prompt += `<Question>\n`;
    prompt += `${test.question}`;
    prompt += `\n</Question>`;
    if (this.USE_INSIGHTS && currentInsights) {
      prompt += `\n\n`;
      prompt += `Take into account the insights about the question accumulated from previous`;
      prompt += ` rounds of explanations and judgements to avoid common pitfalls and explore convincing ideas.`;
      prompt += `\n\n<Insights>\n${currentInsights}\n</Insights>`;
    }
    prompt += `\n</Instructions>`;

    messages.push({
      role: "system",
      content: prompt,
    });

    let content = ``;

    for (let i = 0; i < explanations.length; i++) {
      if (i > 0) {
        content += `\n\n`;
      }
      content += `EXPLANATION ${i}:\n\n${explanations[i].explanation}`;
      for (let j = 0; j < explanations[i].judgements.length; j++) {
        content += `\n\nEXPERT JUDGEMENT ${i} ${j}:\n\n${explanations[i].judgements[j]}`;
      }
    }

    content += `\n\n`;
    content += `Propose an improved explanation and answer.`;
    content += " Start with `REASONING:` and conclude with `ANSWER:`.";

    messages.push({
      role: "user",
      content,
    });

    messages.forEach((m) => {
      console.log(`+++++++++++++++++++++++++++++++`);
      console.log(`[${m.role}]`);
      console.log(`-------------------------------`);
      console.log(`${m.content}`);
    });

    const query: ChatQuery = {
      provider: this.model.provider,
      model: this.model.model(),
      messages,
      temperature: this.TEMPERATURE,
      maxTokens:
        this.dataset.maxTokens().reasoningStep *
        this.dataset.maxTokens().maxStepCount,
    };

    const c = await this.runCompletion(query);

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(
      `CROSSOVER test=${test.id} generation=${generation} iteration=${iteration}`
    );
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(c.content);
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<");

    const answer = this.dataset.parseAnswer(c.content);

    let check = false;
    try {
      check = await this.dataset.check({ test, answer });
    } catch (e) {
      // Nothing to do, check failed.
    }

    console.log("-------------------------");
    console.log(`PROBLEM: ${test.id}`);
    console.log(`ANSWER: ${answer}`);
    console.log(`CHECK: ${check}`);
    console.log("-------------------------");
    console.log("\n\n\n");

    await this.storeCompletion({
      test,
      completion: c,
      query,
      check,
    });
    this.stats();

    return {
      answer,
      check,
      explanation: c.content,
      judgements: [],
    };
  }

  answerFromPool(test: Test, pool: Explanation[]): TestResult {
    const answers: { [key: string]: { check: boolean; count: number } } = {};

    pool.forEach((e) => {
      if (e.answer in answers) {
        answers[e.answer].count += 1;
        if (e.check !== answers[e.answer].check) {
          throw new Error("Invalid check");
        }
      } else {
        answers[e.answer] = { check: e.check, count: 1 };
      }
    });

    let maxCount = 0;
    let maxAnswer = "";
    let maxCheck = false;
    for (const answer in answers) {
      if (answers[answer].count > maxCount) {
        maxCount = answers[answer].count;
        maxAnswer = answer;
        maxCheck = answers[answer].check;
      }
    }

    return {
      check: maxCheck,
      answer: maxAnswer,
      test,
    };
  }

  async aggregateInsights({
    test,
    pool,
    generation,
  }: {
    test: Test;
    pool: Explanation[];
    generation: number;
  }): Promise<void> {
    let currentInsights: string | null = null;

    if (!this.insights[test.id]) {
      this.insights[test.id] = [];
    }
    if (this.insights[test.id].length !== generation) {
      throw new Error("Invalid insights length");
    }
    if (this.insights[test.id].length > 0) {
      currentInsights =
        this.insights[test.id][this.insights[test.id].length - 1];
    }

    const messages: ChatMessage[] = [];

    let prompt = `<Instructions>\n`;
    prompt += `<Task>\n`;
    prompt += this.taskPrompt();
    prompt += `\n</Task>\n\n`;
    prompt += this.explanativePrompt();
    prompt += `\n\n`;
    prompt += `Insights about a question are a condensed (1000 words max) repository of learnings about a question accumulated`;
    prompt += ` across rounds of explanation proposals and expert judgements about them.`;
    prompt += ` Record spotted errors and good strategies in explored explanations so that they`;
    prompt += ` can be presented to future experts working on the explanation of the question,`;
    prompt += ` to ensure future explanations are correct and mistakes are not repeated.`;
    prompt += `\n\n`;
    if (currentInsights) {
      prompt += `Update the current insights about the question based on the last round of explanations and judgements, record common errors, valid reasonings and convincing new ideas.`;
    } else {
      prompt += `Record insights about the question based on the last round of explanations and judgements.`;
    }
    prompt += `\n\n`;
    prompt += `<Question>\n`;
    prompt += `${test.question}`;
    prompt += `\n</Question>`;
    prompt += `\n</Instructions>`;

    messages.push({
      role: "system",
      content: prompt,
    });

    let content = ``;
    if (currentInsights) {
      content += `<Insights>\n${currentInsights}\n</Insights>\n\n`;
    }

    for (let i = 0; i < pool.length; i++) {
      if (i > 0) {
        content += `\n\n`;
      }
      content += `EXPLANATION ${i}:\n\n${pool[i].explanation}`;
      for (let j = 0; j < pool[i].judgements.length; j++) {
        content += `\n\nEXPERT JUDGEMENT ${i} ${j}:\n\n${pool[i].judgements[j]}`;
      }
    }
    content += `\n\n`;

    if (currentInsights) {
      content += `Propose new insights based on the current insights and the most important learnings from the explanations and judgements.`;
    } else {
      content += `Propose insights based on the most important learnings from the explanations and judgements.`;
    }

    messages.push({
      role: "user",
      content,
    });

    messages.forEach((m) => {
      console.log(`+++++++++++++++++++++++++++++++`);
      console.log(`[${m.role}]`);
      console.log(`-------------------------------`);
      console.log(`${m.content}`);
    });

    const query: ChatQuery = {
      provider: this.model.provider,
      model: this.model.model(),
      messages,
      temperature: this.TEMPERATURE,
      maxTokens: 2048,
    };

    const c = await this.runCompletion(query);

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(`INSIGHTS test=${test.id} generation=${generation}`);
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>");
    console.log(c.content);
    console.log("<<<<<<<<<<<<<<<<<<<<<<<<<");
    console.log("\n\n\n");

    await this.storeCompletion({
      test,
      completion: c,
      query,
      check: false,
    });
    this.stats();

    this.insights[test.id].push(c.content);
  }

  async runOne({ test }: { test: Test }): Promise<TestResult> {
    const initQueue = new PQueue({
      concurrency: this.INNER_CONCURRENCY,
    });

    // Initialize the evolutionary pool for the test.
    let pool = (
      await Promise.all(
        Array.from(Array(this.POOL_SIZE).keys()).map((_, i) => {
          return initQueue.add(() =>
            this.initializePool({ test, iteration: i })
          );
        })
      )
    )
      .filter((x) => x)
      .map((x) => x as Explanation);

    if (pool.length !== this.POOL_SIZE) {
      throw new Error("Invalid pool size");
    }

    const recordIteration = (pool: Explanation[], generation: number) => {
      const good = pool.filter((x) => x.check).length;
      const r = this.answerFromPool(test, pool);
      console.log(
        `Iteration: test=${test.id} generation=${generation} good=${good}/${pool.length} check=${r.check}`
      );
      if (this.generationResults[generation] === undefined) {
        this.generationResults[generation] = [];
      }
      this.generationResults[generation].push(r);

      return r;
    };

    for (let generation = 0; generation < this.GENERATIONS; generation++) {
      recordIteration(pool, generation);

      // Judge each explanation in the pool.
      for (let i = 0; i < this.JUDGEMENTS_DEPTH; i++) {
        const judgementQueue = new PQueue({
          concurrency: this.INNER_CONCURRENCY,
        });

        await Promise.all(
          pool.map((e) => {
            return judgementQueue.add(() =>
              this.judgeExplanation({
                test,
                explanation: e,
                generation,
                iteration: i,
              })
            );
          })
        );
      }

      // Insight aggregation.
      if (this.USE_INSIGHTS) {
        await this.aggregateInsights({ test, pool, generation });
      }

      // Cross-over.
      const crossOverQueue = new PQueue({
        concurrency: this.INNER_CONCURRENCY,
      });

      pool = (
        await Promise.all(
          pool.map((_, i) => {
            return crossOverQueue.add(() =>
              this.crossOver({ test, pool, generation, iteration: i })
            );
          })
        )
      )
        .filter((x) => x)
        .map((x) => x as Explanation);

      if (pool.length !== this.POOL_SIZE) {
        throw new Error("Invalid pool size");
      }
    }

    const r = recordIteration(pool, this.GENERATIONS);

    return {
      test,
      answer: r.answer,
      check: r.check,
    };
  }

  computeResults(): void {
    for (let i = 0; i < this.generationResults.length; i++) {
      console.log(
        `Result: algorithm=${this.algorithm()} dataset=${
          this.dataset.dataset
        } ` +
          `provider=${this.model.provider} model=${this.model.model()} ` +
          `generation=${i} ` +
          `check=${
            this.generationResults[i].filter((x) => x.check).length
          } total=${this.generationResults[i].length}`
      );
    }
  }
}
