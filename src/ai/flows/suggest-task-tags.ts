'use server';

/**
 * @fileOverview An AI agent that suggests relevant tags for task descriptions.
 *
 * - suggestTaskTags - A function that handles the task tag suggestion process.
 * - SuggestTaskTagsInput - The input type for the suggestTaskTags function.
 * - SuggestTaskTagsOutput - The return type for the suggestTaskTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaskTagsInputSchema = z.object({
  title: z
    .string()
    .describe('The title of the task for which tags are to be suggested.'),
  description: z
    .string()
    .optional()
    .describe('The optional description of the task.'),
});
export type SuggestTaskTagsInput = z.infer<typeof SuggestTaskTagsInputSchema>;

const SuggestTaskTagsOutputSchema = z.object({
  suggestedTags: z
    .array(z.string())
    .describe('An array of 1-3 relevant tags for the task. Examples: "bug", "feature", "frontend", "design", "refactor".'),
});
export type SuggestTaskTagsOutput = z.infer<typeof SuggestTaskTagsOutputSchema>;

export async function suggestTaskTags(
  input: SuggestTaskTagsInput
): Promise<SuggestTaskTagsOutput> {
  return suggestTaskTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskTagsPrompt',
  input: {schema: SuggestTaskTagsInputSchema},
  output: {schema: SuggestTaskTagsOutputSchema},
  prompt: `You are an AI assistant that analyzes task titles and descriptions to suggest relevant tags for organization.

  Analyze the following task information and suggest 1 to 3 relevant, single-word tags.

  Task Title: {{{title}}}
  Task Description: {{{description}}}

  Return the suggested tags as an array of strings. Keep tags concise and relevant.
  `,
});

const suggestTaskTagsFlow = ai.defineFlow(
  {
    name: 'suggestTaskTagsFlow',
    inputSchema: SuggestTaskTagsInputSchema,
    outputSchema: SuggestTaskTagsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
