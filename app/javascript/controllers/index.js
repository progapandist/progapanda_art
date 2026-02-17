import { application } from "./application"

import DraggableController from "./draggable_controller"
application.register("draggable", DraggableController)

import GalleryController from "./gallery_controller"
application.register("gallery", GalleryController)

import HintsController from "./hints_controller"
application.register("hints", HintsController)
