Rails.application.routes.draw do
  get "up" => "rails/health#show", :as => :rails_health_check

  root "works#index"
  resources :works, only: [:index], param: :slug
  get "works/:slug" => "works#show", :as => "work"
end
