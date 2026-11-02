import type { AppEnv } from '../../../_shared/types'
import { isAdminAuthenticated } from '../../../_shared/auth'
import { fail, ok } from '../../../_shared/response'
import { createBuilderMediaAsset, listBuilderMediaAssets } from '../../../_shared/builder'

function readTextField(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function pickImageFile(formData: FormData): File | null {
  const preferredKeys = ['asset', 'file', 'media', 'image']

  for (const key of preferredKeys) {
    const value = formData.get(key)
    if (value instanceof File && value.size > 0) {
      return value
    }
  }

  for (const value of formData.getAll('assets')) {
    if (value instanceof File && value.size > 0) {
      return value
    }
  }

  return null
}

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  try {
    const authenticated = await isAdminAuthenticated(context.request, context.env)
    if (!authenticated) {
      return fail('Unauthorized.', 401)
    }

    const assets = await listBuilderMediaAssets(context.env.DB)
    return ok(assets)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load builder media.', 500)
  }
}

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  try {
    const authenticated = await isAdminAuthenticated(context.request, context.env)
    if (!authenticated) {
      return fail('Unauthorized.', 401)
    }

    const formData = await context.request.formData()
    const file = pickImageFile(formData)
    if (!file) {
      return fail('No builder media file was provided.', 400)
    }

    const asset = await createBuilderMediaAsset(context.env.DB, context.env.IMAGES, file, {
      altText: readTextField(formData, 'altText'),
      caption: readTextField(formData, 'caption'),
    })

    return ok(asset, 201)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to upload builder media.', 500)
  }
}
