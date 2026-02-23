Rails.application.routes.draw do
  get 'up' => 'rails/health#show', :as => :rails_health_check

  root 'works#index'
  get 'grid' => 'works#grid', :as => :grid
  get 'works/:slug(.:format)' => 'works#show', :as => 'work'
end
