// This file is auto-generated by ./bin/rails stimulus:manifest:update
// Run that command whenever you add a new controller or create them with
// ./bin/rails generate stimulus controllerName

import { application } from "./application"

import DraggableController from "./draggable_controller"
application.register("draggable", DraggableController)

import HelloController from "./hello_controller"
application.register("hello", HelloController)

import HintsController from "./hints_controller"
application.register("hints", HintsController)

import RandomImageController from "./random_image_controller"
application.register("random-image", RandomImageController)

import SessionsController from "./sessions_controller"
application.register("sessions", SessionsController)
