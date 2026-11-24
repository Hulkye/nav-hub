<script setup lang="ts">
import AddOne from '@icon-park/vue-next/es/icons/AddOne'
import AllApplication from '@icon-park/vue-next/es/icons/AllApplication'
import ApplicationMenu from '@icon-park/vue-next/es/icons/ApplicationMenu'
import Book from '@icon-park/vue-next/es/icons/Book'
import CategoryManagement from '@icon-park/vue-next/es/icons/CategoryManagement'
import Close from '@icon-park/vue-next/es/icons/Close'
import Down from '@icon-park/vue-next/es/icons/Down'
import Right from '@icon-park/vue-next/es/icons/Right'
import RightExpand from '@icon-park/vue-next/es/icons/RightExpand'
import ArrowRightUp from '@icon-park/vue-next/es/icons/ArrowRightUp'
import Home from '@icon-park/vue-next/es/icons/Home'
import Left from '@icon-park/vue-next/es/icons/Left'
import LeftExpand from '@icon-park/vue-next/es/icons/LeftExpand'
import MenuFoldOne from '@icon-park/vue-next/es/icons/MenuFoldOne'
import Moon from '@icon-park/vue-next/es/icons/Moon'
import Search from '@icon-park/vue-next/es/icons/Search'
import SunOne from '@icon-park/vue-next/es/icons/SunOne'
import Translate from '@icon-park/vue-next/es/icons/Translate'
import Up from '@icon-park/vue-next/es/icons/Up'
import UploadWeb from '@icon-park/vue-next/es/icons/UploadWeb'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })
const iconMap = { add: AddOne, all: AllApplication, article: ApplicationMenu, book: Book, category: CategoryManagement, close: Close, down: Down, up: Up, left: Left, right: Right, 'left-expand': LeftExpand, 'right-expand': RightExpand, 'arrow-up-right': ArrowRightUp, home: Home, menu: MenuFoldOne, moon: Moon, search: Search, sun: SunOne, translate: Translate, upload: UploadWeb }
const iconComponent = computed(() => iconMap[props.name as keyof typeof iconMap] ?? Home)
</script>

<template>
  <component :is="iconComponent" class="icon-park" :size="size" theme="outline" :stroke-width="2" aria-hidden="true" />
</template>
