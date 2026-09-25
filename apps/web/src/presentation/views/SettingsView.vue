<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useMessage, type FormInst, type FormRules, type UploadCustomRequestOptions, type UploadFileInfo } from "naive-ui"
import { CloudUploadOutline, StorefrontOutline, TrashOutline } from "@vicons/ionicons5"
import { useStoreProfileStore } from "../../stores/storeProfileStore"
import { palette, radius } from "../../theme/naiveOverrides"
import { es } from "../../i18n/es"
import { formatDate } from "../../i18n/format"

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"]

const storeProfile = useStoreProfileStore()
const message = useMessage()

const formRef = ref<FormInst | null>(null)
const form = reactive({ name: "", adminName: "", contactEmail: "" })

const rules: FormRules = {
  name: [{ required: true, trigger: ["blur", "input"], message: es.settings.storeNameRequired }],
  contactEmail: [{ type: "email", trigger: ["blur"], message: es.settings.emailInvalid }],
}

const cardTitleStyle = { fontSize: "16px", fontWeight: 500 }
const logoUrl = computed(() => storeProfile.profile?.logoUrl ?? null)

watch(
  () => storeProfile.profile,
  (profile) => {
    form.name = profile?.name ?? ""
    form.adminName = profile?.adminName ?? ""
    form.contactEmail = profile?.contactEmail ?? ""
  },
  { immediate: true },
)

onMounted(() => {
  if (storeProfile.profile === null) void storeProfile.load()
})

async function handleSave(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  try {
    await storeProfile.save({
      name: form.name.trim(),
      adminName: form.adminName.trim() === "" ? null : form.adminName.trim(),
      contactEmail: form.contactEmail.trim() === "" ? null : form.contactEmail.trim(),
    })
    message.success(es.settings.saved)
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.settings.saveFailed)
  }
}

function beforeLogoUpload({ file }: { file: UploadFileInfo }): boolean {
  const raw = file.file
  if (!raw) return false
  if (!LOGO_TYPES.includes(raw.type)) {
    message.warning(es.settings.logoWrongType)
    return false
  }
  if (raw.size > LOGO_MAX_BYTES) {
    message.warning(es.settings.logoTooLarge)
    return false
  }
  return true
}

async function uploadLogo({ file, onFinish, onError }: UploadCustomRequestOptions): Promise<void> {
  if (!file.file) return onError()
  try {
    await storeProfile.uploadLogo(file.file)
    onFinish()
    message.success(es.settings.logoUploaded)
  } catch (error) {
    onError()
    message.error(error instanceof Error ? error.message : es.settings.logoFailed)
  }
}

async function removeLogo(): Promise<void> {
  try {
    await storeProfile.removeLogo()
    message.success(es.settings.logoRemoved)
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.settings.logoFailed)
  }
}
</script>

<template>
  <n-flex vertical :size="24">
    <n-flex vertical :size="2">
      <n-text :style="{ fontSize: '20px', fontWeight: 500 }">{{ es.settings.title }}</n-text>
      <n-text depth="3" :style="{ fontSize: '12px' }">{{ es.settings.subtitle }}</n-text>
    </n-flex>

    <n-spin :show="storeProfile.loading && storeProfile.profile === null">
      <n-grid cols="1 m:5" :x-gap="24" :y-gap="24" responsive="screen">
        <!-- Datos de la tienda -->
        <n-gi span="1 m:3">
          <n-card :bordered="false">
            <template #header>
              <n-text :style="cardTitleStyle">{{ es.settings.profileTitle }}</n-text>
            </template>
            <template #header-extra>
              <n-text v-if="storeProfile.profile" depth="3" :style="{ fontSize: '11px' }">
                {{ es.settings.lastUpdated(formatDate(storeProfile.profile.updatedAt)) }}
              </n-text>
            </template>
            <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" @submit.prevent="handleSave">
              <n-form-item :label="es.settings.storeName" path="name">
                <n-input
                  v-model:value="form.name"
                  :placeholder="es.settings.storeNamePlaceholder"
                  :maxlength="120"
                  :input-props="{ id: 'store-name', autocomplete: 'organization' }"
                />
              </n-form-item>
              <n-form-item :label="es.settings.adminName" path="adminName">
                <n-input
                  v-model:value="form.adminName"
                  :placeholder="es.settings.adminNamePlaceholder"
                  :maxlength="120"
                  :input-props="{ id: 'admin-name', autocomplete: 'name' }"
                />
              </n-form-item>
              <n-form-item :label="es.settings.contactEmail" path="contactEmail">
                <n-input
                  v-model:value="form.contactEmail"
                  :placeholder="es.settings.contactEmailPlaceholder"
                  :input-props="{ id: 'contact-email', autocomplete: 'email', type: 'email' }"
                />
              </n-form-item>
              <n-flex justify="end">
                <n-button type="primary" attr-type="submit" :loading="storeProfile.saving">{{ es.settings.save }}</n-button>
              </n-flex>
            </n-form>
          </n-card>
        </n-gi>

        <!-- Logo -->
        <n-gi span="1 m:2">
          <n-card :bordered="false">
            <template #header>
              <n-text :style="cardTitleStyle">{{ es.settings.logoTitle }}</n-text>
            </template>
            <n-flex vertical :size="16">
              <n-flex align="center" :size="16" :wrap="false">
                <n-avatar
                  round
                  :size="88"
                  :src="logoUrl ?? undefined"
                  object-fit="cover"
                  :style="{ background: palette.brandDeep, color: palette.accent, flexShrink: 0 }"
                >
                  <n-icon v-if="!logoUrl" :component="StorefrontOutline" :size="36" />
                </n-avatar>
                <n-flex vertical :size="6">
                  <n-text :style="{ fontSize: '14px', fontWeight: 500 }">{{ storeProfile.profile?.name ?? es.settings.logoEmpty }}</n-text>
                  <n-text depth="3" :style="{ fontSize: '12px' }">{{ es.settings.logoHint }}</n-text>
                  <n-button
                    v-if="logoUrl"
                    size="small"
                    secondary
                    :loading="storeProfile.uploadingLogo"
                    :style="{ alignSelf: 'flex-start' }"
                    @click="removeLogo"
                  >
                    <template #icon><n-icon :component="TrashOutline" /></template>
                    {{ es.settings.logoRemove }}
                  </n-button>
                </n-flex>
              </n-flex>

              <n-upload
                :custom-request="uploadLogo"
                :show-file-list="false"
                accept="image/png,image/jpeg,image/webp"
                :disabled="storeProfile.uploadingLogo"
                @before-upload="beforeLogoUpload"
              >
                <n-upload-dragger :style="{ borderRadius: radius.md, background: 'var(--surface)' }">
                  <n-flex vertical align="center" :size="8">
                    <n-spin v-if="storeProfile.uploadingLogo" size="small" />
                    <n-icon v-else :component="CloudUploadOutline" :size="32" color="var(--data)" />
                    <n-text :style="{ fontSize: '13px' }">{{ es.settings.logoDrop }}</n-text>
                  </n-flex>
                </n-upload-dragger>
              </n-upload>
            </n-flex>
          </n-card>
        </n-gi>
      </n-grid>
    </n-spin>
  </n-flex>
</template>
