'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function deleteAnalysis(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const analysisId = formData.get('analysisId') as string
  const adminSupabase = createAdminClient()

  const { data: analysis } = await adminSupabase
    .from('analyses')
    .select('image_url, user_id')
    .eq('id', analysisId)
    .single()

  if (!analysis || analysis.user_id !== user.id) return { error: 'Not found' }

  // Storage paths follow {user_id}/{analysis_id}/original.jpg pattern
  const basePath = analysis.image_url?.replace('/original.jpg', '') ?? ''
  if (basePath) {
    await adminSupabase.storage.from('images').remove([
      `${basePath}/original.jpg`,
      `${basePath}/thumb.jpg`,
    ])
  }

  await adminSupabase.from('analyses').delete().eq('id', analysisId)

  revalidatePath('/', 'layout')
  return {}
}

export async function submitRating(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const analysisId = formData.get('analysisId') as string
  const entries = Array.from(formData.entries())

  const ratings = entries
    .filter(([key]) => key.startsWith('category_'))
    .map(([key, value]) => {
      const category = key.replace('category_', '')
      const comment = (formData.get(`comment_${category}`) as string) || null
      return {
        analysis_id: analysisId,
        user_id: user.id,
        category,
        rating: parseInt(value as string, 10),
        comment,
      }
    })
    .filter(r => r.rating >= 1 && r.rating <= 5)

  if (ratings.length === 0) return { error: 'No valid ratings' }

  const { error } = await supabase
    .from('recommendation_ratings')
    .upsert(ratings, { onConflict: 'analysis_id,user_id,category' })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

type IngredientCount = { ingredient: string; count: number }

export async function getTopIngredients(userId: string): Promise<IngredientCount[]> {
  const supabase = await createClient()

  const { data: ratings } = await supabase
    .from('recommendation_ratings')
    .select('analysis_id, category')
    .eq('user_id', userId)
    .gte('rating', 4)

  if (!ratings?.length) return []

  const analysisIds = [...new Set(ratings.map(r => r.analysis_id))]

  const { data: results } = await supabase
    .from('analysis_results')
    .select('analysis_id, recommendations')
    .in('analysis_id', analysisIds)

  const ingredientCounts: Record<string, number> = {}

  for (const result of results ?? []) {
    type Rec = { category: string; key_ingredients: string[] }
    const recs = result.recommendations as unknown as Rec[]
    const highRatedCats = ratings
      .filter(r => r.analysis_id === result.analysis_id)
      .map(r => r.category)

    for (const rec of recs ?? []) {
      if (highRatedCats.includes(rec.category)) {
        for (const ing of rec.key_ingredients ?? []) {
          ingredientCounts[ing] = (ingredientCounts[ing] ?? 0) + 1
        }
      }
    }
  }

  return Object.entries(ingredientCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([ingredient, count]) => ({ ingredient, count }))
}
