class WorksController < ApplicationController
  before_action :authenticate, only: [:show, :index]

  def index
    @pagy, works = pagy(Work.all, items: 1)
    @work = works.sole
    @max_page = @pagy.pages
  end

  def show
    @work = Work.find_by(slug: params[:slug]) || random_work

    track_view(@work.slug)
  end

  private

  def current_user
    Current.user
  end

  def authenticate
    user_repo = UserRepository.instance
    Current.user = user_repo.find(params[:i]) || user_repo.create(SecureRandom.hex(8))
  end

  def track_view(slug)
    return unless current_user

    current_user.views << slug
    current_user.views.uniq!

    all_slugs = Work.pluck(:slug)
    current_user.views.clear if current_user.views.size >= all_slugs.size
  end

  def random_work
    if current_user
      unseen = Work.excluding_slugs(current_user.views)
      current_user.views.clear if unseen.empty?
      unseen.first_random || Work.first_random
    else
      Work.first_random
    end
  end
end
