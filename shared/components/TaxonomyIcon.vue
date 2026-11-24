<script setup lang="ts">
import {
  CategoryManagement, Tag, Comment, Search, Workbench, Book, Translate, Browser, Edit, Picture,
  Video, Music, ColorCard, Cube, User, ScanCode, Code, Robot, Connection, Api, Github, ChartLine,
  ShoppingCart, School, Briefcase, Terminal, FolderOpen, People, ReadBook, Calendar, NewspaperFolding
} from '@icon-park/vue-next'
import { isTaxonomyIcon, type TaxonomyIconName } from '../utils/taxonomy-icons'

const props = withDefaults(defineProps<{ name?: string | null; fallback?: TaxonomyIconName; size?: number }>(), { fallback: 'CategoryManagement', size: 18 })
const icons = {
  CategoryManagement, Tag, Comment, Search, Workbench, Book, Translate, Browser, Edit, Picture,
  Video, Music, ColorCard, Cube, User, ScanCode, Code, Robot, Connection, Api, Github, ChartLine,
  ShoppingCart, School, Briefcase, Terminal, FolderOpen, People, ReadBook, Calendar, NewspaperFolding
} satisfies Record<TaxonomyIconName, typeof Book>
const icon = computed(() => icons[props.name && isTaxonomyIcon(props.name) ? props.name : props.fallback])
</script>

<template>
  <component :is="icon" class="icon-park" :size="size" theme="outline" :stroke-width="2" aria-hidden="true" />
</template>
